package main

import (
	"path/filepath"
	"testing"
)

func TestCommunityAnonymousPrivacyAndPsychologistActivity(t *testing.T) {
	store, err := newStore(filepath.Join(t.TempDir(), "careflow.json"))
	if err != nil {
		t.Fatalf("newStore() error = %v", err)
	}
	if err := ensureRoleDemoAccounts(store); err != nil {
		t.Fatalf("ensureRoleDemoAccounts() error = %v", err)
	}

	psychologist, ok := store.findUserByEmail("psychologist@careflow.local")
	if !ok {
		t.Fatal("psychologist demo account was not seeded")
	}
	client, _, err := store.createUser(Credentials{Name: "Client Community", Email: "client-community@example.com", Password: "safe-password"})
	if err != nil {
		t.Fatalf("create client: %v", err)
	}
	other, _, err := store.createUser(Credentials{Name: "Other Community", Email: "other-community@example.com", Password: "safe-password"})
	if err != nil {
		t.Fatalf("create other user: %v", err)
	}
	if err := store.selectPsychologist(client.ID, psychologist.ID, false); err != nil {
		t.Fatalf("select psychologist: %v", err)
	}

	named, err := store.createCommunityPost(client.ID, CommunityPostInput{Body: "I'm trying to take a pause before sleep.", TopicTag: "Reflection"})
	if err != nil {
		t.Fatalf("create named post: %v", err)
	}
	if len(named.ID) != 36 || named.ID[8] != '-' || named.ID[13] != '-' || named.ID[14] != '4' || named.ID[18] != '-' || named.ID[23] != '-' {
		t.Fatalf("community post ID = %q, want UUID v4", named.ID)
	}
	anonymous, err := store.createCommunityPost(other.ID, CommunityPostInput{Body: "I need a space to be heard without a name.", TopicTag: "Need a friend", IsAnonymous: true})
	if err != nil {
		t.Fatalf("create anonymous post: %v", err)
	}
	if _, err := store.createCommunityComment(client.ID, anonymous.ID, CommunityCommentInput{Body: "I hear you. Take it slow, okay."}); err != nil {
		t.Fatalf("create comment on anonymous post: %v", err)
	}
	if !store.psychologistCanViewCommunityPost(psychologist.ID, named.ID) || !store.psychologistCanViewCommunityPost(psychologist.ID, anonymous.ID) {
		t.Fatal("psychologist should view the client's named post and commented activity")
	}

	feed, err := store.communityFeed(client.ID)
	if err != nil {
		t.Fatalf("communityFeed() error = %v", err)
	}
	var anonymousView CommunityPostView
	for _, post := range feed {
		if post.ID == anonymous.ID {
			anonymousView = post
			break
		}
	}
	if anonymousView.AuthorName != "Anonymous" {
		t.Fatalf("anonymous author leaked as %q", anonymousView.AuthorName)
	}
	detail, err := store.communityPostByID(client.ID, named.ID)
	if err != nil || detail.ID != named.ID {
		t.Fatalf("community post detail = (%#v, %v), want %s", detail, err, named.ID)
	}

	activity, err := store.communityActivity(psychologist.ID, client.ID)
	if err != nil {
		t.Fatalf("communityActivity() error = %v", err)
	}
	if len(activity.Posts) != 1 || activity.Posts[0].ID != named.ID {
		t.Fatalf("named posts = %#v, want only %s", activity.Posts, named.ID)
	}
	if len(activity.Comments) != 1 || activity.Comments[0].PostID != anonymous.ID {
		t.Fatalf("comment activity = %#v, want comment on anonymous post", activity.Comments)
	}
	if !activity.Comments[0].PostIsAnonymous || activity.Comments[0].PostAuthorName != "Anonymous" {
		t.Fatalf("anonymous parent leaked through activity: %#v", activity.Comments[0])
	}
}
