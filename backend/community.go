package main

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"
)

const (
	communityMediaMaxBytes = 4 * 1024 * 1024
	communityFeedLimit     = 60
)

func newCommunityPostID() string {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return newID()
	}
	bytes[6] = (bytes[6] & 0x0f) | 0x40
	bytes[8] = (bytes[8] & 0x3f) | 0x80
	return hex.EncodeToString(bytes[0:4]) + "-" + hex.EncodeToString(bytes[4:6]) + "-" + hex.EncodeToString(bytes[6:8]) + "-" + hex.EncodeToString(bytes[8:10]) + "-" + hex.EncodeToString(bytes[10:16])
}

type CommunityPost struct {
	ID          string    `json:"id"`
	AuthorID    string    `json:"authorId"`
	IsAnonymous bool      `json:"isAnonymous"`
	IsHidden    bool      `json:"isHidden"`
	TopicTag    string    `json:"topicTag"`
	Body        string    `json:"body"`
	MediaMime   string    `json:"mediaMime,omitempty"`
	MediaData   string    `json:"mediaData,omitempty"`
	MediaBytes  int       `json:"mediaBytes"`
	CreatedAt   time.Time `json:"createdAt"`
}

type CommunityComment struct {
	ID        string    `json:"id"`
	PostID    string    `json:"postId"`
	AuthorID  string    `json:"authorId"`
	Body      string    `json:"body"`
	CreatedAt time.Time `json:"createdAt"`
}

type CommunityReaction struct {
	ID        string    `json:"id"`
	PostID    string    `json:"postId"`
	UserID    string    `json:"userId"`
	CreatedAt time.Time `json:"createdAt"`
}

type CommunityShare struct {
	ID        string    `json:"id"`
	PostID    string    `json:"postId"`
	UserID    string    `json:"userId"`
	CreatedAt time.Time `json:"createdAt"`
}

type CommunityState struct {
	Posts     []CommunityPost     `json:"posts"`
	Comments  []CommunityComment  `json:"comments"`
	Reactions []CommunityReaction `json:"reactions"`
	Shares    []CommunityShare    `json:"shares"`
}

type CommunityPostInput struct {
	Body        string `json:"body"`
	TopicTag    string `json:"topicTag"`
	IsAnonymous bool   `json:"isAnonymous"`
	MediaMime   string `json:"mediaMime,omitempty"`
	MediaData   string `json:"mediaData,omitempty"`
}

type CommunityCommentInput struct {
	Body string `json:"body"`
}

type CommunityModerationInput struct {
	IsHidden *bool `json:"isHidden"`
}

type CommunityCommentView struct {
	ID         string    `json:"id"`
	PostID     string    `json:"postId"`
	AuthorName string    `json:"authorName"`
	Body       string    `json:"body"`
	CreatedAt  time.Time `json:"createdAt"`
}

type CommunityPostView struct {
	ID          string                 `json:"id"`
	AuthorName  string                 `json:"authorName"`
	IsAnonymous bool                   `json:"isAnonymous"`
	IsHidden    bool                   `json:"isHidden"`
	TopicTag    string                 `json:"topicTag"`
	Body        string                 `json:"body"`
	MediaMime   string                 `json:"mediaMime,omitempty"`
	MediaData   string                 `json:"mediaData,omitempty"`
	CreatedAt   time.Time              `json:"createdAt"`
	LikeCount   int                    `json:"likeCount"`
	CommentCount int                   `json:"commentCount"`
	ShareCount  int                    `json:"shareCount"`
	LikedByMe   bool                   `json:"likedByMe"`
	IsMine      bool                   `json:"isMine"`
	Comments    []CommunityCommentView `json:"comments"`
}

type CommunityActivityPost struct {
	ID        string    `json:"id"`
	TopicTag  string    `json:"topicTag"`
	Body      string    `json:"body"`
	CreatedAt time.Time `json:"createdAt"`
}

type CommunityActivityComment struct {
	ID               string    `json:"id"`
	PostID           string    `json:"postId"`
	Body             string    `json:"body"`
	PostPreview      string    `json:"postPreview"`
	PostAuthorName   string    `json:"postAuthorName"`
	PostIsAnonymous  bool      `json:"postIsAnonymous"`
	CreatedAt        time.Time `json:"createdAt"`
}

type CommunityActivity struct {
	Posts    []CommunityActivityPost    `json:"posts"`
	Comments []CommunityActivityComment `json:"comments"`
}

func normalizeCommunityText(value string, min, max int, field string) (string, error) {
	value = strings.TrimSpace(value)
	if len(value) < min || len(value) > max {
		return "", fmt.Errorf("%s must be between %d and %d characters", field, min, max)
	}
	return value, nil
}

func validateCommunityMedia(mime, data string) (string, string, int, error) {
	mime = strings.ToLower(strings.TrimSpace(mime))
	data = strings.TrimSpace(data)
	if mime == "" && data == "" {
		return "", "", 0, nil
	}
	allowed := map[string]bool{
		"image/jpeg": true, "image/png": true, "image/webp": true, "image/gif": true,
		"video/mp4": true, "video/webm": true, "video/quicktime": true,
	}
	if !allowed[mime] {
		return "", "", 0, errors.New("media format must be JPEG, PNG, WEBP, GIF, MP4, WEBM, or MOV")
	}
	prefix := "data:" + mime + ";base64,"
	if !strings.HasPrefix(data, prefix) {
		return "", "", 0, errors.New("invalid media data")
	}
	decoded, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(data, prefix))
	if err != nil || len(decoded) == 0 {
		return "", "", 0, errors.New("invalid media data")
	}
	if len(decoded) > communityMediaMaxBytes {
		return "", "", 0, errors.New("photo or video size must be at most 4 MB")
	}
	return mime, data, len(decoded), nil
}

func (s *Store) createCommunityPost(authorID string, input CommunityPostInput) (CommunityPost, error) {
	body, err := normalizeCommunityText(input.Body, 1, 2000, "post content")
	if err != nil {
		return CommunityPost{}, err
	}
	topic := strings.TrimSpace(input.TopicTag)
	if topic == "" {
		topic = "Safe space"
	}
	if len(topic) > 40 {
		return CommunityPost{}, errors.New("topic must be at most 40 characters")
	}
	mime, data, bytes, err := validateCommunityMedia(input.MediaMime, input.MediaData)
	if err != nil {
		return CommunityPost{}, err
	}
	post := CommunityPost{ID: newCommunityPostID(), AuthorID: authorID, IsAnonymous: input.IsAnonymous, TopicTag: topic, Body: body, MediaMime: mime, MediaData: data, MediaBytes: bytes, CreatedAt: time.Now().UTC()}
	if s.db != nil {
		ctx, cancel := context.WithTimeout(context.Background(), databaseTimeout)
		defer cancel()
		_, err = s.db.ExecContext(ctx, `INSERT INTO community_posts (id,author_id,is_anonymous,topic_tag,body,media_mime,media_data,media_bytes,created_at) VALUES ($1,$2,$3,$4,$5,NULLIF($6,''),NULLIF($7,''),$8,$9)`, post.ID, post.AuthorID, post.IsAnonymous, post.TopicTag, post.Body, post.MediaMime, post.MediaData, post.MediaBytes, post.CreatedAt)
		if err != nil {
			return CommunityPost{}, fmt.Errorf("save community post: %w", err)
		}
		return post, nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.community.Posts = append(s.community.Posts, post)
	if err := s.saveLocked(); err != nil {
		return CommunityPost{}, err
	}
	return post, nil
}

func (s *Store) createCommunityComment(authorID, postID string, input CommunityCommentInput) (CommunityComment, error) {
	body, err := normalizeCommunityText(input.Body, 1, 1200, "comment")
	if err != nil {
		return CommunityComment{}, err
	}
	if !s.communityPostExists(postID) {
		return CommunityComment{}, errors.New("post not found")
	}
	comment := CommunityComment{ID: newID(), PostID: postID, AuthorID: authorID, Body: body, CreatedAt: time.Now().UTC()}
	if s.db != nil {
		ctx, cancel := context.WithTimeout(context.Background(), databaseTimeout)
		defer cancel()
		_, err = s.db.ExecContext(ctx, `INSERT INTO community_comments (id,post_id,author_id,body,created_at) VALUES ($1,$2,$3,$4,$5)`, comment.ID, comment.PostID, comment.AuthorID, comment.Body, comment.CreatedAt)
		if err != nil {
			return CommunityComment{}, fmt.Errorf("save community comment: %w", err)
		}
		return comment, nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.community.Comments = append(s.community.Comments, comment)
	if err := s.saveLocked(); err != nil {
		return CommunityComment{}, err
	}
	return comment, nil
}

func (s *Store) communityPostExists(postID string) bool {
	if s.db != nil {
		ctx, cancel := context.WithTimeout(context.Background(), databaseTimeout)
		defer cancel()
		var exists bool
		if err := s.db.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM community_posts WHERE id=$1 AND is_hidden=FALSE)`, postID).Scan(&exists); err != nil {
			return false
		}
		return exists
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, post := range s.community.Posts {
		if post.ID == postID && !post.IsHidden {
			return true
		}
	}
	return false
}

func (s *Store) toggleCommunityLike(userID, postID string) (bool, error) {
	if !s.communityPostExists(postID) {
		return false, errors.New("post not found")
	}
	if s.db != nil {
		ctx, cancel := context.WithTimeout(context.Background(), databaseTimeout)
		defer cancel()
		var reactionID string
		err := s.db.QueryRowContext(ctx, `SELECT id FROM community_reactions WHERE post_id=$1 AND user_id=$2`, postID, userID).Scan(&reactionID)
		if err == nil {
			_, err = s.db.ExecContext(ctx, `DELETE FROM community_reactions WHERE id=$1`, reactionID)
			return false, err
		}
		if !errors.Is(err, sql.ErrNoRows) {
			return false, err
		}
		_, err = s.db.ExecContext(ctx, `INSERT INTO community_reactions (id,post_id,user_id,created_at) VALUES ($1,$2,$3,$4)`, newID(), postID, userID, time.Now().UTC())
		return err == nil, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	for index, item := range s.community.Reactions {
		if item.PostID == postID && item.UserID == userID {
			s.community.Reactions = append(s.community.Reactions[:index], s.community.Reactions[index+1:]...)
			return false, s.saveLocked()
		}
	}
	s.community.Reactions = append(s.community.Reactions, CommunityReaction{ID: newID(), PostID: postID, UserID: userID, CreatedAt: time.Now().UTC()})
	return true, s.saveLocked()
}

func (s *Store) recordCommunityShare(userID, postID string) error {
	if !s.communityPostExists(postID) {
		return errors.New("post not found")
	}
	share := CommunityShare{ID: newID(), PostID: postID, UserID: userID, CreatedAt: time.Now().UTC()}
	if s.db != nil {
		ctx, cancel := context.WithTimeout(context.Background(), databaseTimeout)
		defer cancel()
		_, err := s.db.ExecContext(ctx, `INSERT INTO community_shares (id,post_id,user_id,created_at) VALUES ($1,$2,$3,$4)`, share.ID, share.PostID, share.UserID, share.CreatedAt)
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.community.Shares = append(s.community.Shares, share)
	return s.saveLocked()
}

func (s *Store) deleteCommunityPost(userID, postID string) error {
	if s.db != nil {
		ctx, cancel := context.WithTimeout(context.Background(), databaseTimeout)
		defer cancel()
		var authorID string
		err := s.db.QueryRowContext(ctx, `SELECT author_id FROM community_posts WHERE id=$1`, postID).Scan(&authorID)
		if errors.Is(err, sql.ErrNoRows) {
			return errors.New("post not found")
		}
		if err != nil {
			return err
		}
		if authorID != userID {
			return errors.New("you can only delete your own post")
		}
		tx, err := s.db.BeginTx(ctx, nil)
		if err != nil {
			return err
		}
		defer func() { _ = tx.Rollback() }()
		if _, err := tx.ExecContext(ctx, `DELETE FROM community_comments WHERE post_id=$1`, postID); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `DELETE FROM community_reactions WHERE post_id=$1`, postID); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `DELETE FROM community_shares WHERE post_id=$1`, postID); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `DELETE FROM community_posts WHERE id=$1`, postID); err != nil {
			return err
		}
		return tx.Commit()
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	found := false
	keepPosts := s.community.Posts[:0]
	for _, post := range s.community.Posts {
		if post.ID == postID {
			if post.AuthorID != userID {
				return errors.New("you can only delete your own post")
			}
			found = true
			continue
		}
		keepPosts = append(keepPosts, post)
	}
	if !found {
		return errors.New("post not found")
	}
	s.community.Posts = keepPosts
	keepComments := s.community.Comments[:0]
	for _, comment := range s.community.Comments {
		if comment.PostID != postID {
			keepComments = append(keepComments, comment)
		}
	}
	s.community.Comments = keepComments
	keepReactions := s.community.Reactions[:0]
	for _, reaction := range s.community.Reactions {
		if reaction.PostID != postID {
			keepReactions = append(keepReactions, reaction)
		}
	}
	s.community.Reactions = keepReactions
	keepShares := s.community.Shares[:0]
	for _, share := range s.community.Shares {
		if share.PostID != postID {
			keepShares = append(keepShares, share)
		}
	}
	s.community.Shares = keepShares
	return s.saveLocked()
}

func (s *Store) setCommunityPostHidden(postID string, hidden bool) error {
	if s.db != nil {
		ctx, cancel := context.WithTimeout(context.Background(), databaseTimeout)
		defer cancel()
		result, err := s.db.ExecContext(ctx, `UPDATE community_posts SET is_hidden=$1 WHERE id=$2`, hidden, postID)
		if err != nil {
			return err
		}
		count, err := result.RowsAffected()
		if err != nil {
			return err
		}
		if count == 0 {
			return errors.New("post not found")
		}
		return nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	for index := range s.community.Posts {
		if s.community.Posts[index].ID == postID {
			s.community.Posts[index].IsHidden = hidden
			return s.saveLocked()
		}
	}
	return errors.New("post not found")
}

func communityPreview(body string) string {
	runes := []rune(strings.TrimSpace(body))
	if len(runes) <= 110 {
		return string(runes)
	}
	return string(runes[:110]) + "…"
}

func (s *Store) communityFeed(viewerID string) ([]CommunityPostView, error) {
	return s.communityFeedForViewer(viewerID, false)
}

func (s *Store) communityModerationFeed() ([]CommunityPostView, error) {
	return s.communityFeedForViewer("", true)
}

func (s *Store) communityFeedForViewer(viewerID string, includeHidden bool) ([]CommunityPostView, error) {
	if s.db != nil {
		return s.communityFeedPostgres(viewerID, includeHidden)
	}
	s.mu.RLock()
	posts := append([]CommunityPost(nil), s.community.Posts...)
	comments := append([]CommunityComment(nil), s.community.Comments...)
	reactions := append([]CommunityReaction(nil), s.community.Reactions...)
	shares := append([]CommunityShare(nil), s.community.Shares...)
	users := append([]User(nil), s.users...)
	s.mu.RUnlock()
	userNames := make(map[string]string, len(users))
	for _, user := range users {
		userNames[user.ID] = user.Name
	}
	sort.Slice(posts, func(i, j int) bool { return posts[i].CreatedAt.After(posts[j].CreatedAt) })
	result := make([]CommunityPostView, 0, min(len(posts), communityFeedLimit))
	for _, post := range posts {
		if post.IsHidden && !includeHidden {
			continue
		}
		if len(result) >= communityFeedLimit {
			break
		}
		view := communityPostView(post, userNames[post.AuthorID], viewerID, comments, reactions, shares, userNames)
		result = append(result, view)
	}
	return result, nil
}

func (s *Store) communityPostByID(viewerID, postID string) (CommunityPostView, error) {
	posts, err := s.communityFeed(viewerID)
	if err != nil {
		return CommunityPostView{}, err
	}
	for _, post := range posts {
		if post.ID == postID {
			return post, nil
		}
	}
	return CommunityPostView{}, errors.New("post not found")
}

func communityPostView(post CommunityPost, authorName, viewerID string, comments []CommunityComment, reactions []CommunityReaction, shares []CommunityShare, userNames map[string]string) CommunityPostView {
	if post.IsAnonymous {
		authorName = "Anonymous"
	}
	view := CommunityPostView{ID: post.ID, AuthorName: authorName, IsAnonymous: post.IsAnonymous, IsHidden: post.IsHidden, TopicTag: post.TopicTag, Body: post.Body, MediaMime: post.MediaMime, MediaData: post.MediaData, CreatedAt: post.CreatedAt, IsMine: post.AuthorID == viewerID, Comments: []CommunityCommentView{}}
	for _, reaction := range reactions {
		if reaction.PostID == post.ID {
			view.LikeCount++
			if reaction.UserID == viewerID {
				view.LikedByMe = true
			}
		}
	}
	for _, share := range shares {
		if share.PostID == post.ID {
			view.ShareCount++
		}
	}
	for _, comment := range comments {
		if comment.PostID == post.ID {
			view.Comments = append(view.Comments, CommunityCommentView{ID: comment.ID, PostID: comment.PostID, AuthorName: userNames[comment.AuthorID], Body: comment.Body, CreatedAt: comment.CreatedAt})
		}
	}
	sort.Slice(view.Comments, func(i, j int) bool { return view.Comments[i].CreatedAt.Before(view.Comments[j].CreatedAt) })
	view.CommentCount = len(view.Comments)
	return view
}

func (s *Store) communityFeedPostgres(viewerID string, includeHidden bool) ([]CommunityPostView, error) {
	ctx, cancel := context.WithTimeout(context.Background(), databaseTimeout)
	defer cancel()
	visibilityClause := "WHERE p.is_hidden=FALSE"
	if includeHidden {
		visibilityClause = ""
	}
	rows, err := s.db.QueryContext(ctx, `
		SELECT p.id,p.author_id,p.is_anonymous,p.is_hidden,p.topic_tag,p.body,COALESCE(p.media_mime,''),COALESCE(p.media_data,''),p.media_bytes,p.created_at,u.name,
			COALESCE((SELECT COUNT(*) FROM community_reactions r WHERE r.post_id=p.id),0),
			COALESCE((SELECT COUNT(*) FROM community_comments c WHERE c.post_id=p.id),0),
			COALESCE((SELECT COUNT(*) FROM community_shares sh WHERE sh.post_id=p.id),0),
			EXISTS(SELECT 1 FROM community_reactions own WHERE own.post_id=p.id AND own.user_id=$1)
		FROM community_posts p JOIN users u ON u.id=p.author_id ` + visibilityClause + `
		ORDER BY p.created_at DESC LIMIT $2`, viewerID, communityFeedLimit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	posts := []CommunityPostView{}
	for rows.Next() {
		var post CommunityPostView
		var authorID string
		if err := rows.Scan(&post.ID, &authorID, &post.IsAnonymous, &post.IsHidden, &post.TopicTag, &post.Body, &post.MediaMime, &post.MediaData, new(int), &post.CreatedAt, &post.AuthorName, &post.LikeCount, &post.CommentCount, &post.ShareCount, &post.LikedByMe); err != nil {
			return nil, err
		}
		if post.IsAnonymous {
			post.AuthorName = "Anonymous"
		}
		post.IsMine = authorID == viewerID
		post.Comments = []CommunityCommentView{}
		posts = append(posts, post)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(posts) == 0 {
		return posts, nil
	}
	comments, err := s.communityCommentsPostgres(posts)
	if err != nil {
		return nil, err
	}
	byPost := map[string][]CommunityCommentView{}
	for _, comment := range comments {
		byPost[comment.PostID] = append(byPost[comment.PostID], comment)
	}
	for index := range posts {
		posts[index].Comments = byPost[posts[index].ID]
		if posts[index].Comments == nil {
			posts[index].Comments = []CommunityCommentView{}
		}
	}
	return posts, nil
}

func (s *Store) communityCommentsPostgres(posts []CommunityPostView) ([]CommunityCommentView, error) {
	ids := make([]string, 0, len(posts))
	for _, post := range posts {
		ids = append(ids, post.ID)
	}
	ctx, cancel := context.WithTimeout(context.Background(), databaseTimeout)
	defer cancel()
	rows, err := s.db.QueryContext(ctx, `SELECT c.id,c.post_id,c.body,c.created_at,u.name FROM community_comments c JOIN users u ON u.id=c.author_id WHERE c.post_id = ANY($1) ORDER BY c.created_at ASC`, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []CommunityCommentView{}
	for rows.Next() {
		var comment CommunityCommentView
		if err := rows.Scan(&comment.ID, &comment.PostID, &comment.Body, &comment.CreatedAt, &comment.AuthorName); err != nil {
			return nil, err
		}
		result = append(result, comment)
	}
	return result, rows.Err()
}

func (s *Store) communityActivity(psychologistID, clientID string) (CommunityActivity, error) {
	client, ok := s.findUserByID(clientID)
	if !ok || normalizedRole(client.Role) != roleUser || client.PsychologistID != psychologistID {
		return CommunityActivity{}, errors.New("client is not assigned to this psychologist")
	}
	if s.db != nil {
		return s.communityActivityPostgres(clientID)
	}
	s.mu.RLock()
	posts := append([]CommunityPost(nil), s.community.Posts...)
	comments := append([]CommunityComment(nil), s.community.Comments...)
	users := append([]User(nil), s.users...)
	s.mu.RUnlock()
	byID := map[string]CommunityPost{}
	userNames := map[string]string{}
	for _, post := range posts { byID[post.ID] = post }
	for _, user := range users { userNames[user.ID] = user.Name }
	result := CommunityActivity{Posts: []CommunityActivityPost{}, Comments: []CommunityActivityComment{}}
	for _, post := range posts {
		if post.AuthorID == clientID && !post.IsAnonymous && !post.IsHidden {
			result.Posts = append(result.Posts, CommunityActivityPost{ID: post.ID, TopicTag: post.TopicTag, Body: post.Body, CreatedAt: post.CreatedAt})
		}
	}
	for _, comment := range comments {
		if comment.AuthorID != clientID { continue }
		post, exists := byID[comment.PostID]
		if !exists || post.IsHidden { continue }
		authorName := userNames[post.AuthorID]
		if post.IsAnonymous { authorName = "Anonymous" }
		result.Comments = append(result.Comments, CommunityActivityComment{ID: comment.ID, PostID: post.ID, Body: comment.Body, PostPreview: communityPreview(post.Body), PostAuthorName: authorName, PostIsAnonymous: post.IsAnonymous, CreatedAt: comment.CreatedAt})
	}
	sort.Slice(result.Posts, func(i, j int) bool { return result.Posts[i].CreatedAt.After(result.Posts[j].CreatedAt) })
	sort.Slice(result.Comments, func(i, j int) bool { return result.Comments[i].CreatedAt.After(result.Comments[j].CreatedAt) })
	return result, nil
}

func (s *Store) communityActivityPostgres(clientID string) (CommunityActivity, error) {
	ctx, cancel := context.WithTimeout(context.Background(), databaseTimeout)
	defer cancel()
	result := CommunityActivity{Posts: []CommunityActivityPost{}, Comments: []CommunityActivityComment{}}
	posts, err := s.db.QueryContext(ctx, `SELECT id,topic_tag,body,created_at FROM community_posts WHERE author_id=$1 AND is_anonymous=FALSE AND is_hidden=FALSE ORDER BY created_at DESC LIMIT 10`, clientID)
	if err != nil { return result, err }
	for posts.Next() {
		var item CommunityActivityPost
		if err := posts.Scan(&item.ID, &item.TopicTag, &item.Body, &item.CreatedAt); err != nil { posts.Close(); return result, err }
		result.Posts = append(result.Posts, item)
	}
	posts.Close()
	comments, err := s.db.QueryContext(ctx, `
		SELECT c.id,c.post_id,c.body,c.created_at,p.body,p.is_anonymous,u.name
		FROM community_comments c JOIN community_posts p ON p.id=c.post_id JOIN users u ON u.id=p.author_id
		WHERE c.author_id=$1 AND p.is_hidden=FALSE ORDER BY c.created_at DESC LIMIT 12`, clientID)
	if err != nil { return result, err }
	defer comments.Close()
	for comments.Next() {
		var item CommunityActivityComment
		if err := comments.Scan(&item.ID, &item.PostID, &item.Body, &item.CreatedAt, &item.PostPreview, &item.PostIsAnonymous, &item.PostAuthorName); err != nil { return result, err }
		item.PostPreview = communityPreview(item.PostPreview)
		if item.PostIsAnonymous { item.PostAuthorName = "Anonymous" }
		result.Comments = append(result.Comments, item)
	}
	return result, comments.Err()
}

func handleCommunityFeed(store *Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, viewer, ok := authenticatedUser(r, store)
		if !ok { writeError(w, http.StatusUnauthorized, "please log in first"); return }
		if role := normalizedRole(viewer.Role); role != roleUser && role != roleAdmin {
			writeError(w, http.StatusForbidden, "community access is not available for this account")
			return
		}
		posts, err := store.communityFeed(viewer.ID)
		if err != nil { writeError(w, http.StatusInternalServerError, "failed to load community"); return }
		writeJSON(w, http.StatusOK, map[string]any{"posts": posts})
	}
}

func (s *Store) psychologistCanViewCommunityPost(psychologistID, postID string) bool {
	if s.db != nil {
		ctx, cancel := context.WithTimeout(context.Background(), databaseTimeout)
		defer cancel()
		var authorID string
		var isAnonymous, isHidden, hasClientComment bool
		err := s.db.QueryRowContext(ctx, `
			SELECT p.author_id,p.is_anonymous,p.is_hidden,
				EXISTS(SELECT 1 FROM community_comments c JOIN user_access a ON a.user_id=c.author_id WHERE c.post_id=p.id AND a.role='user' AND a.psychologist_id=$2)
			FROM community_posts p WHERE p.id=$1`, postID, psychologistID).Scan(&authorID, &isAnonymous, &isHidden, &hasClientComment)
		if err != nil || isHidden {
			return false
		}
		author, exists := s.findUserByID(authorID)
		return hasClientComment || (exists && !isAnonymous && author.PsychologistID == psychologistID)
	}
	s.mu.RLock()
	posts := append([]CommunityPost(nil), s.community.Posts...)
	comments := append([]CommunityComment(nil), s.community.Comments...)
	users := append([]User(nil), s.users...)
	s.mu.RUnlock()
	usersByID := map[string]User{}
	for _, user := range users { usersByID[user.ID] = user }
	for _, post := range posts {
		if post.ID != postID || post.IsHidden { continue }
		if author, exists := usersByID[post.AuthorID]; exists && !post.IsAnonymous && author.PsychologistID == psychologistID {
			return true
		}
		for _, comment := range comments {
			if comment.PostID == postID && usersByID[comment.AuthorID].PsychologistID == psychologistID {
				return true
			}
		}
	}
	return false
}

func handleCreateCommunityPost(store *Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, ok := requireRole(r, store, roleUser)
		if !ok { writeError(w, http.StatusForbidden, "user accounts only"); return }
		var input CommunityPostInput
		if decodeJSONWithLimit(w, r, &input, 6<<20) != nil { return }
		post, err := store.createCommunityPost(user.ID, input)
		if err != nil { writeError(w, http.StatusBadRequest, err.Error()); return }
		writeJSON(w, http.StatusCreated, post)
	}
}

func handleCommunityPost(store *Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, viewer, ok := authenticatedUser(r, store)
		if !ok { writeError(w, http.StatusUnauthorized, "please log in first"); return }
		postID := r.PathValue("id")
		switch normalizedRole(viewer.Role) {
		case roleUser, roleAdmin:
		case rolePsychologist:
			if !store.psychologistCanViewCommunityPost(viewer.ID, postID) { writeError(w, http.StatusForbidden, "this community activity does not belong to your client"); return }
		default:
			writeError(w, http.StatusForbidden, "community access is not available for this account"); return
		}
		post, err := store.communityPostByID(viewer.ID, postID)
		if err != nil { writeError(w, http.StatusNotFound, err.Error()); return }
		writeJSON(w, http.StatusOK, post)
	}
}


func handleCreateCommunityComment(store *Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, ok := requireRole(r, store, roleUser)
		if !ok { writeError(w, http.StatusForbidden, "user accounts only"); return }
		var input CommunityCommentInput
		if decodeJSON(w, r, &input) != nil { return }
		comment, err := store.createCommunityComment(user.ID, r.PathValue("id"), input)
		if err != nil { writeError(w, http.StatusBadRequest, err.Error()); return }
		writeJSON(w, http.StatusCreated, comment)
	}
}

func handleToggleCommunityLike(store *Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, ok := requireRole(r, store, roleUser)
		if !ok { writeError(w, http.StatusForbidden, "user accounts only"); return }
		liked, err := store.toggleCommunityLike(user.ID, r.PathValue("id"))
		if err != nil { writeError(w, http.StatusBadRequest, err.Error()); return }
		writeJSON(w, http.StatusOK, map[string]bool{"liked": liked})
	}
}

func handleCommunityShare(store *Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, ok := requireRole(r, store, roleUser)
		if !ok { writeError(w, http.StatusForbidden, "user accounts only"); return }
		if err := store.recordCommunityShare(user.ID, r.PathValue("id")); err != nil { writeError(w, http.StatusBadRequest, err.Error()); return }
		writeJSON(w, http.StatusCreated, map[string]bool{"recorded": true})
	}
}

func handleDeleteCommunityPost(store *Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, ok := requireRole(r, store, roleUser)
		if !ok { writeError(w, http.StatusForbidden, "user accounts only"); return }
		if err := store.deleteCommunityPost(user.ID, r.PathValue("id")); err != nil {
			status := http.StatusBadRequest
			if err.Error() == "post not found" { status = http.StatusNotFound }
			if err.Error() == "you can only delete your own post" { status = http.StatusForbidden }
			writeError(w, status, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"deleted": true})
	}
}

func handleAdminCommunityPosts(store *Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if _, ok := requireRole(r, store, roleAdmin); !ok {
			writeError(w, http.StatusForbidden, "admin only")
			return
		}
		posts, err := store.communityModerationFeed()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to load community posts")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"posts": posts})
	}
}

func handleAdminCommunityPostUpdate(store *Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if _, ok := requireRole(r, store, roleAdmin); !ok {
			writeError(w, http.StatusForbidden, "admin only")
			return
		}
		var input CommunityModerationInput
		if decodeJSON(w, r, &input) != nil {
			return
		}
		if input.IsHidden == nil {
			writeError(w, http.StatusBadRequest, "isHidden is required")
			return
		}
		if err := store.setCommunityPostHidden(r.PathValue("id"), *input.IsHidden); err != nil {
			status := http.StatusBadRequest
			if err.Error() == "post not found" {
				status = http.StatusNotFound
			}
			writeError(w, status, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"id": r.PathValue("id"), "isHidden": *input.IsHidden})
	}
}

func handlePsychologistCommunityActivity(store *Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		psychologist, ok := requireRole(r, store, rolePsychologist)
		if !ok { writeError(w, http.StatusForbidden, "psychologist accounts only"); return }
		activity, err := store.communityActivity(psychologist.ID, r.PathValue("id"))
		if err != nil { writeError(w, http.StatusForbidden, err.Error()); return }
		writeJSON(w, http.StatusOK, activity)
	}
}
