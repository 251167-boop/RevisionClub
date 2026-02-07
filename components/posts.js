'use client';

import { formatDate } from '@/lib/format';
import { LikeButton } from './like-icon';
import { togglePostLikeStatus } from '@/actions/posts';
import { useOptimistic } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import slugify from 'slugify';

function imageLoader({ src, quality = 100 }) {
  const urlStart = src.split('upload/')[0];
  const urlEnd = src.split('upload/')[1];
  const transformations = `w_600,q_${quality}`; // wider and higher quality
  return `${urlStart}upload/${transformations}/${urlEnd}`;
}

export async function Post({ post, action, user }) {
  const postSlug = post.slug ? post.slug : slugify(post.title);
  return (
    <article className="post compact-post zoom" style={{ marginTop: '20px', position: 'relative' }}>
      <Link href={`/blog/${postSlug}`} style={{ textDecoration: 'none' }}>
        <div className="post-image">
          <Image
            loader={imageLoader}
            src={post.image}
            alt={post.title}
            width={400}
            height={250}
            quality={70}
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '10px',
              objectFit: 'cover',
            }}
          />
        </div>
        <div className="post-content">
          <header>
            <div>
              <h2>{post.title}</h2>
              <p>
                Shared by {post.username || 'Unknown User'} on{' '}
                <time dateTime={post.createdAt}>
                  {formatDate(post.createdAt)}
                </time>
              </p>
            </div>
          </header>
          <p style={{ textDecoration: 'underline' }}>Click to view more!</p>
        </div>
      </Link>

      {/* 👇 Like button at bottom right */}
      <form
        action={action.bind(null, post.id)}
        className={`like-form ${post.isLiked ? 'liked' : ''}`}
      >
        <LikeButton />
      </form>
    </article>
  );
}

export default function Posts({ posts, user }) {
  const [optimisticPosts, updateOptimisticPosts] = useOptimistic(posts, (prevPosts, updatePostId) => {
    const updatedPostIndex = prevPosts.findIndex((post) => post.id === updatePostId);

    if (updatedPostIndex === -1) {
      return prevPosts;
    }

    const updatedPost = { ...prevPosts[updatedPostIndex] };
    updatedPost.likes = updatedPost.likes + (updatedPost.isLiked ? -1 : 1);
    updatedPost.isLiked = !updatedPost.isLiked;
    const newPosts = [...prevPosts];
    newPosts[updatedPostIndex] = updatedPost;
    return newPosts;
  });

  if (!optimisticPosts || optimisticPosts.length === 0) {
    return <p>There are no posts yet. Maybe start sharing some?</p>;
  }

  async function updatePost(postId) {
    updateOptimisticPosts(postId);
    try {
      await togglePostLikeStatus(postId);
    } catch (error) {
      // Roll back optimistic update on failure.
      updateOptimisticPosts(postId);
      throw error;
    }
  }

  return (
    <ul className="posts">
      {optimisticPosts.map((post) => (
        <li key={post.id}>
          <Post post={post} action={updatePost} user={user}/>
        </li>
      ))}
    </ul>
  );
}
