// Command seed-demo populates a Careflow PostgreSQL database with a full set
// of demo data: the standard demo/admin/psychologist accounts, two extra
// dummy user accounts, 30 days of daily metrics and session history for the
// demo account, a psychologist consultation link with sample chat messages,
// and five illustrated community posts.
//
// It is safe to run multiple times (idempotent): existing rows are updated
// in place rather than duplicated. Run it after the backend has started at
// least once (so the `users`/`user_access`/etc. tables already exist), for
// example:
//
//	DATABASE_URL=postgres://careflow:PASSWORD@HOST:5432/careflow?sslmode=disable \
//	  go run ./cmd/seed-demo
package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"log"
	"math"
	"math/rand"
	"os"
	"time"

	"golang.org/x/crypto/bcrypt"

	_ "github.com/jackc/pgx/v5/stdlib"
)

type seedUser struct {
	id       string
	name     string
	email    string
	password string
	role     string
}

func main() {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL environment variable is required")
	}
	db, err := sql.Open("pgx", dbURL)
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	defer db.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		log.Fatalf("ping db: %v", err)
	}

	admin := ensureAccount(ctx, db, "Careflow Admin", "admin@careflow.local", "AdminCareflow2026!", "admin")
	psychologist := ensureAccount(ctx, db, "Dr. Anya Putri", "psychologist@careflow.local", "Psychologist2026!", "psychologist")
	demo := ensureAccount(ctx, db, "Careflow Demo", "demo@careflow.local", "CareflowDemo2026!", "user")
	raka := ensureAccount(ctx, db, "Raka Wijaya", "raka.wijaya@careflow.local", "DummyUser2026!", "user")
	siti := ensureAccount(ctx, db, "Siti Amara", "siti.amara@careflow.local", "DummyUser2026!", "user")
	_ = admin

	linkPsychologist(ctx, db, demo.id, psychologist.id)

	location, err := time.LoadLocation("Asia/Jakarta")
	if err != nil {
		location = time.Local
	}
	now := time.Now().In(location)
	rng := rand.New(rand.NewSource(42))

	seedDailyMetrics(ctx, db, demo.id, now, location, rng)
	seedSessions(ctx, db, demo.id, now, location, rng)
	seedChatMessages(ctx, db, demo.id, psychologist.id)
	seedCommunityPosts(ctx, db, raka.id, siti.id, now)

	fmt.Println("\nDemo seeding complete. Accounts:")
	fmt.Printf("  Admin:        %s / AdminCareflow2026!\n", admin.email)
	fmt.Printf("  Psychologist: %s / Psychologist2026!\n", psychologist.email)
	fmt.Printf("  Demo user:    %s / CareflowDemo2026!\n", demo.email)
	fmt.Printf("  Dummy user 1: %s / DummyUser2026!\n", raka.email)
	fmt.Printf("  Dummy user 2: %s / DummyUser2026!\n", siti.email)
}

func newID() string {
	buf := make([]byte, 16)
	if _, err := rand.New(rand.NewSource(time.Now().UnixNano())).Read(buf); err != nil {
		log.Fatalf("generate id: %v", err)
	}
	return hex.EncodeToString(buf)
}

func ensureAccount(ctx context.Context, db *sql.DB, name, email, password, role string) seedUser {
	var id string
	err := db.QueryRowContext(ctx, `SELECT id FROM users WHERE email=$1`, email).Scan(&id)
	if err == sql.ErrNoRows {
		hash, hashErr := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if hashErr != nil {
			log.Fatalf("hash password for %s: %v", email, hashErr)
		}
		id = newID()
		_, err = db.ExecContext(ctx, `
			INSERT INTO users (id, name, email, password_hash, created_at)
			VALUES ($1, $2, $3, $4, NOW())`,
			id, name, email, string(hash))
		if err != nil {
			log.Fatalf("insert user %s: %v", email, err)
		}
		fmt.Printf("Created account %s (%s)\n", name, email)
	} else if err != nil {
		log.Fatalf("lookup user %s: %v", email, err)
	} else {
		fmt.Printf("Account already exists: %s (%s)\n", name, email)
	}

	_, err = db.ExecContext(ctx, `
		INSERT INTO user_access (user_id, role, is_banned, share_data_with_psychologist, updated_at)
		VALUES ($1, $2, FALSE, FALSE, NOW())
		ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role
		WHERE user_access.role IS DISTINCT FROM EXCLUDED.role`,
		id, role)
	if err != nil {
		log.Fatalf("set role for %s: %v", email, err)
	}

	return seedUser{id: id, name: name, email: email, password: password, role: role}
}

func linkPsychologist(ctx context.Context, db *sql.DB, userID, psychologistID string) {
	_, err := db.ExecContext(ctx, `
		UPDATE user_access
		SET psychologist_id = $2, share_data_with_psychologist = TRUE, updated_at = NOW()
		WHERE user_id = $1`,
		userID, psychologistID)
	if err != nil {
		log.Fatalf("link psychologist: %v", err)
	}
	fmt.Println("Linked demo user to Dr. Anya Putri with data sharing enabled")
}

func seedDailyMetrics(ctx context.Context, db *sql.DB, userID string, now time.Time, location *time.Location, rng *rand.Rand) {
	moods := []string{"Below average night", "Restless", "Deep sleep", "Okay", "Great rest"}
	count := 0
	for daysAgo := 0; daysAgo < 30; daysAgo++ {
		date := now.AddDate(0, 0, -daysAgo)
		metricDate := date.Format("2006-01-02")

		sleepHours := 5.5 + rng.Float64()*3.0
		sleepHours = float64(int(sleepHours*10)) / 10

		base := 35.0
		weekday := date.Weekday()
		if weekday == time.Monday || weekday == time.Tuesday {
			base = 55.0
		}
		stress := int(base + rng.Float64()*25 - 10)
		if stress < 5 {
			stress = 5
		}
		if stress > 95 {
			stress = 95
		}
		label := moods[rng.Intn(len(moods))]
		createdAt := date.Add(-time.Duration(daysAgo) * time.Minute)
		id := "seed-metric-" + userID[:8] + "-" + fmt.Sprint(daysAgo)

		_, err := db.ExecContext(ctx, `
			INSERT INTO daily_metrics (id, user_id, metric_date, sleep_hours, stress_score, stress_label, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
			ON CONFLICT (user_id, metric_date) DO UPDATE SET
				sleep_hours = EXCLUDED.sleep_hours,
				stress_score = EXCLUDED.stress_score,
				stress_label = EXCLUDED.stress_label,
				updated_at = EXCLUDED.updated_at`,
			id, userID, metricDate, sleepHours, stress, label, createdAt.In(location))
		if err != nil {
			log.Fatalf("insert daily_metrics day -%d: %v", daysAgo, err)
		}
		count++
	}
	fmt.Printf("Seeded %d daily_metrics rows\n", count)
}

func seedSessions(ctx context.Context, db *sql.DB, userID string, now time.Time, location *time.Location, rng *rand.Rand) {
	moods := []string{"Happy", "Sleepy", "Bored", "Angry"}
	mascots := []string{"Gentle", "Spun Out", "Fuming", "Zapped", "Drowsy"}

	streakDays := 14
	count := 0
	for daysAgo := 0; daysAgo < streakDays; daysAgo++ {
		insertSession(ctx, db, userID, now, daysAgo, location, moods, mascots, rng)
		count++
	}
	sparseOlderDays := []int{16, 17, 19, 22, 23, 24, 27, 29}
	for _, daysAgo := range sparseOlderDays {
		insertSession(ctx, db, userID, now, daysAgo, location, moods, mascots, rng)
		count++
	}
	fmt.Printf("Seeded %d sessions rows (streak window: %d consecutive days)\n", count, streakDays)
}

func insertSession(ctx context.Context, db *sql.DB, userID string, now time.Time, daysAgo int, location *time.Location, moods, mascots []string, rng *rand.Rand) {
	date := now.AddDate(0, 0, -daysAgo)
	createdAt := time.Date(date.Year(), date.Month(), date.Day(), 9+rng.Intn(10), rng.Intn(60), 0, 0, location)
	mood := moods[rng.Intn(len(moods))]
	mascot := mascots[rng.Intn(len(mascots))]
	completedTasks := rng.Intn(4)
	totalXP := completedTasks * (10 + rng.Intn(15))
	id := "seed-session-" + userID[:8] + "-" + fmt.Sprint(daysAgo)

	_, err := db.ExecContext(ctx, `
		INSERT INTO sessions (id, user_id, created_at, mood, mascot, completed_tasks_count, total_xp)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (id) DO NOTHING`,
		id, userID, createdAt, mood, mascot, completedTasks, totalXP)
	if err != nil {
		log.Fatalf("insert sessions day -%d: %v", daysAgo, err)
	}

	for i := 0; i < completedTasks; i++ {
		taskID := fmt.Sprintf("seed-task-%s-%d-%d", userID[:8], daysAgo, i)
		xp := 10 + rng.Intn(15)
		completedAt := createdAt.Add(time.Duration(i) * 3 * time.Minute)
		_, err := db.ExecContext(ctx, `
			INSERT INTO task_completions (id, user_id, xp, completed_at)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (id) DO NOTHING`,
			taskID, userID, xp, completedAt)
		if err != nil {
			log.Fatalf("insert task_completions day -%d: %v", daysAgo, err)
		}
	}
}

func seedChatMessages(ctx context.Context, db *sql.DB, demoID, psychologistID string) {
	type msg struct {
		senderID, recipientID, content string
		minutesAgo                     int
	}
	messages := []msg{
		{demoID, psychologistID, "Hi Dr. Anya, I've been trying the daily check-ins this month and I think my sleep has been a bit better.", 180},
		{psychologistID, demoID, "That's great to hear! I can see your sleep trend improving over the past few weeks. How has your stress level felt day to day?", 170},
		{demoID, psychologistID, "Still a bit high around weekdays, but the breathing exercises in Flow Studio help a lot.", 160},
		{psychologistID, demoID, "Good to know it's helping. Let's keep an eye on your weekday stress and check in again next week.", 150},
	}
	count := 0
	for i, m := range messages {
		id := fmt.Sprintf("seed-chat-%d", i)
		createdAt := time.Now().Add(-time.Duration(m.minutesAgo) * time.Minute)
		_, err := db.ExecContext(ctx, `
			INSERT INTO chat_messages (id, sender_id, recipient_id, content, created_at)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (id) DO NOTHING`,
			id, m.senderID, m.recipientID, m.content, createdAt)
		if err != nil {
			log.Fatalf("insert chat message %d: %v", i, err)
		}
		count++
	}
	fmt.Printf("Seeded %d chat_messages rows\n", count)
}

const canvasW, canvasH = 640, 480

func newCanvas(bg color.RGBA) *image.RGBA {
	img := image.NewRGBA(image.Rect(0, 0, canvasW, canvasH))
	for y := 0; y < canvasH; y++ {
		for x := 0; x < canvasW; x++ {
			img.Set(x, y, bg)
		}
	}
	return img
}

func fillCircle(img *image.RGBA, cx, cy, r int, c color.RGBA) {
	for y := cy - r; y <= cy+r; y++ {
		for x := cx - r; x <= cx+r; x++ {
			if x < 0 || y < 0 || x >= canvasW || y >= canvasH {
				continue
			}
			if math.Hypot(float64(x-cx), float64(y-cy)) <= float64(r) {
				img.Set(x, y, c)
			}
		}
	}
}

func fillRect(img *image.RGBA, x0, y0, x1, y1 int, c color.RGBA) {
	for y := y0; y < y1; y++ {
		for x := x0; x < x1; x++ {
			if x < 0 || y < 0 || x >= canvasW || y >= canvasH {
				continue
			}
			img.Set(x, y, c)
		}
	}
}

func strokeCircleRing(img *image.RGBA, cx, cy, r, thickness int, c color.RGBA) {
	for y := cy - r - thickness; y <= cy+r+thickness; y++ {
		for x := cx - r - thickness; x <= cx+r+thickness; x++ {
			if x < 0 || y < 0 || x >= canvasW || y >= canvasH {
				continue
			}
			d := math.Hypot(float64(x-cx), float64(y-cy))
			if d >= float64(r) && d <= float64(r+thickness) {
				img.Set(x, y, c)
			}
		}
	}
}

func drawStar(img *image.RGBA, cx, cy, size int, c color.RGBA) {
	fillRect(img, cx-size/6, cy-size, cx+size/6, cy+size, c)
	fillRect(img, cx-size, cy-size/6, cx+size, cy+size/6, c)
}

func encodePNG(img *image.RGBA) string {
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		log.Fatalf("encode png: %v", err)
	}
	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(buf.Bytes())
}

func imageStreakWin() string {
	img := newCanvas(color.RGBA{184, 255, 169, 255})
	green := color.RGBA{57, 120, 51, 255}
	fillCircle(img, canvasW/2, canvasH/2, 150, green)
	fillCircle(img, canvasW/2, canvasH/2, 130, color.RGBA{184, 255, 169, 255})
	fillRect(img, canvasW/2-90, canvasH/2-6, canvasW/2-15, canvasH/2+20, green)
	fillRect(img, canvasW/2-40, canvasH/2+40, canvasW/2+90, canvasH/2+70, green)
	drawStar(img, canvasW/2-170, canvasH/2-140, 18, color.RGBA{255, 214, 92, 255})
	drawStar(img, canvasW/2+180, canvasH/2-120, 14, color.RGBA{255, 214, 92, 255})
	drawStar(img, canvasW/2+150, canvasH/2+150, 16, color.RGBA{255, 214, 92, 255})
	return encodePNG(img)
}

func imageNightOverthinking() string {
	img := newCanvas(color.RGBA{35, 41, 74, 255})
	fillCircle(img, canvasW/2, canvasH/2-10, 90, color.RGBA{255, 236, 179, 255})
	fillCircle(img, canvasW/2+45, canvasH/2-40, 90, color.RGBA{35, 41, 74, 255})
	drawStar(img, 120, 90, 8, color.RGBA{255, 255, 255, 255})
	drawStar(img, 500, 70, 10, color.RGBA{255, 255, 255, 255})
	drawStar(img, 90, 320, 6, color.RGBA{255, 255, 255, 255})
	drawStar(img, 550, 350, 8, color.RGBA{255, 255, 255, 255})
	drawStar(img, 300, 60, 6, color.RGBA{255, 255, 255, 255})
	strokeCircleRing(img, canvasW/2, canvasH/2+140, 60, 4, color.RGBA{197, 225, 255, 180})
	strokeCircleRing(img, canvasW/2, canvasH/2+140, 90, 4, color.RGBA{197, 225, 255, 120})
	return encodePNG(img)
}

func imageTidyWorkspace() string {
	img := newCanvas(color.RGBA{245, 240, 230, 255})
	fillRect(img, 40, 300, 600, 340, color.RGBA{193, 154, 107, 255})
	fillRect(img, 60, 340, 100, 440, color.RGBA{150, 111, 74, 255})
	fillRect(img, 540, 340, 580, 440, color.RGBA{150, 111, 74, 255})
	fillRect(img, 100, 140, 260, 300, color.RGBA{121, 98, 140, 255})
	fillRect(img, 115, 155, 245, 285, color.RGBA{241, 219, 255, 255})
	fillCircle(img, 340, 220, 45, color.RGBA{57, 120, 51, 255})
	fillRect(img, 320, 175, 360, 220, color.RGBA{57, 120, 51, 255})
	fillRect(img, 400, 160, 560, 300, color.RGBA{45, 90, 168, 255})
	for i := 0; i < 4; i++ {
		fillRect(img, 415, 180+i*28, 545, 200+i*28, color.RGBA{197, 225, 255, 255})
	}
	return encodePNG(img)
}

func imageDeadlineToMissions() string {
	img := newCanvas(color.RGBA{254, 235, 210, 255})
	rust := color.RGBA{193, 102, 60, 255}
	fillRect(img, 70, 90, 260, 140, rust)
	fillRect(img, 90, 130, 240, 170, color.RGBA{193, 102, 60, 200})
	fillRect(img, 110, 170, 220, 200, color.RGBA{193, 102, 60, 150})
	strokeCircleRing(img, 460, 230, 110, 10, rust)
	fillRect(img, 455, 150, 465, 230, rust)
	fillRect(img, 460, 225, 520, 235, rust)
	for i := 0; i < 3; i++ {
		x := 90 + i*70
		fillRect(img, x, 330, x+30, 360, color.RGBA{57, 120, 51, 255})
	}
	return encodePNG(img)
}

func imageSleepTrend() string {
	img := newCanvas(color.RGBA{223, 205, 245, 255})
	fillCircle(img, 130, 120, 70, color.RGBA{255, 236, 179, 255})
	fillCircle(img, 155, 95, 70, color.RGBA{223, 205, 245, 255})
	points := []int{330, 300, 260, 220, 170, 140}
	baseX, gap := 120, 80
	lineColor := color.RGBA{121, 98, 140, 255}
	for i := 0; i < len(points)-1; i++ {
		x0, y0 := baseX+i*gap, points[i]
		x1, y1 := baseX+(i+1)*gap, points[i+1]
		steps := 40
		for s := 0; s <= steps; s++ {
			t := float64(s) / float64(steps)
			x := int(float64(x0) + t*float64(x1-x0))
			y := int(float64(y0) + t*float64(y1-y0))
			fillCircle(img, x, y, 4, lineColor)
		}
		fillCircle(img, x0, y0, 8, color.RGBA{57, 120, 51, 255})
	}
	fillCircle(img, baseX+(len(points)-1)*gap, points[len(points)-1], 8, color.RGBA{57, 120, 51, 255})
	return encodePNG(img)
}

func seedCommunityPosts(ctx context.Context, db *sql.DB, rakaID, sitiID string, now time.Time) {
	type postSeed struct {
		id        string
		authorID  string
		topicTag  string
		body      string
		mediaData string
		hoursAgo  int
	}

	posts := []postSeed{
		{id: "seed-post-raka-1", authorID: rakaID, topicTag: "Small wins", body: "Finally finished my 5-minute mission streak for the week. Small steps really do add up! 🌱", mediaData: imageStreakWin(), hoursAgo: 96},
		{id: "seed-post-raka-2", authorID: rakaID, topicTag: "Late Night Overthinking 🌙", body: "Anyone else's brain get loud right before bed? Doing the box breathing exercise tonight, hoping it helps.", mediaData: imageNightOverthinking(), hoursAgo: 48},
		{id: "seed-post-siti-1", authorID: sitiID, topicTag: "Safe space", body: "Grateful for this community. Just wanted to share a photo of my workspace after decluttering it today. Feels so much calmer here now.", mediaData: imageTidyWorkspace(), hoursAgo: 72},
		{id: "seed-post-siti-2", authorID: sitiID, topicTag: "Need a friend", body: "Rough week with deadlines piling up, but breaking tasks into tiny missions in Flow Studio has been a lifesaver.", mediaData: imageDeadlineToMissions(), hoursAgo: 24},
		{id: "seed-post-siti-3", authorID: sitiID, topicTag: "Reflection", body: "Slept better this week after logging my sleep every night. Turns out just tracking it made me more mindful of my bedtime.", mediaData: imageSleepTrend(), hoursAgo: 6},
	}

	count := 0
	for _, post := range posts {
		createdAt := now.Add(-time.Duration(post.hoursAgo) * time.Hour)
		decoded, err := base64.StdEncoding.DecodeString(post.mediaData[len("data:image/png;base64,"):])
		if err != nil {
			log.Fatalf("decode media for %s: %v", post.id, err)
		}
		_, err = db.ExecContext(ctx, `
			INSERT INTO community_posts (id, author_id, is_anonymous, topic_tag, body, media_mime, media_data, media_bytes, created_at)
			VALUES ($1, $2, FALSE, $3, $4, 'image/png', $5, $6, $7)
			ON CONFLICT (id) DO UPDATE SET
				body = EXCLUDED.body,
				media_mime = EXCLUDED.media_mime,
				media_data = EXCLUDED.media_data,
				media_bytes = EXCLUDED.media_bytes`,
			post.id, post.authorID, post.topicTag, post.body, post.mediaData, len(decoded), createdAt)
		if err != nil {
			log.Fatalf("insert community_posts %s: %v", post.id, err)
		}
		count++
	}
	fmt.Printf("Seeded %d community_posts rows\n", count)
}
