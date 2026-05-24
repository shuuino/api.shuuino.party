const commentsEl = document.getElementById('comments');
const statusEl = document.getElementById('status');
const loadMoreButton = document.getElementById('load-more');
let nextCursor = null;

function setStatus(message, isError = true) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? '#b00' : '#080';
}

function formatComment(comment) {
  const wrapper = document.createElement('article');
  wrapper.className = 'comment';

  const header = document.createElement('div');
  header.className = 'comment-header';

  const name = document.createElement('span');
  name.className = 'comment-name';
  name.textContent = comment.name || 'anonymous';
  // Color admin comments differently
  if (comment.name === 'Shuuino' || comment.name === 'admin') {
    name.style.color = '#0066cc';
    name.style.fontWeight = '900';
  }

  const time = document.createElement('time');
  time.className = 'comment-time';
  time.textContent = new Date(comment.createdAt).toLocaleString();
  time.dateTime = comment.createdAt;

  header.append(name, time);

  const message = document.createElement('p');
  message.textContent = comment.message;

  wrapper.append(header, message);
  return wrapper;
}


async function loadComments(reset = true) {
  if (reset) {
    commentsEl.innerHTML = '';
    nextCursor = null;
    loadMoreButton.hidden = true;
    setStatus('Loading comments...', false);
  } else {
    setStatus('Loading more comments...', false);
  }

  const url = new URL('/guestbook', window.location.origin);
  url.searchParams.set('limit', '50');
  if (!reset && nextCursor) {
    url.searchParams.set('cursor', nextCursor);
  }

  try {
    const res = await fetch(url.toString());
    const data = await res.json();

    if (!res.ok) {
      setStatus(data.error || 'Failed to load comments');
      return;
    }

    if (reset && (!data.comments || data.comments.length === 0)) {
      commentsEl.innerHTML = '<p>No comments yet. Be the first!</p>';
      setStatus('', false);
      return;
    }

    data.comments.forEach((comment) => {
      commentsEl.appendChild(formatComment(comment));
    });

    nextCursor = data.cursor || null;
    loadMoreButton.hidden = !nextCursor;
    setStatus('', false);
  } catch (error) {
    setStatus('Unable to load comments.');
    console.error(error);
  }
}

async function postComment(event) {
  event.preventDefault();
  setStatus('', false);

  const name = document.getElementById('name').value.trim();
  const message = document.getElementById('message').value.trim();

  if (!message) {
    setStatus('Please enter a message.');
    return;
  }

  try {
    const res = await fetch('/guestbook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, message }),
    });
    const data = await res.json();

    if (!res.ok) {
      setStatus(data.error || 'Failed to post comment.');
      return;
    }

    document.getElementById('message').value = '';
    setStatus('Comment sent!', false);
    await loadComments(true);
  } catch (error) {
    setStatus('Unable to send comment.');
    console.error(error);
  }
}

document.getElementById('guestbook-form').addEventListener('submit', postComment);
loadMoreButton.addEventListener('click', () => loadComments(false));
window.addEventListener('DOMContentLoaded', () => loadComments(true));
