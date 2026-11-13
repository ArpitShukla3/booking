/** TASK-X3: "Read full review" — scrolls to the review card (id `review-<review_id>`) and flashes it. */
export function scrollToReview(reviewId: string) {
  const el = document.getElementById(`review-${reviewId}`);
  if (!el) return;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
  el.classList.remove('ar-flash');
  void el.offsetWidth; // restart the animation
  el.classList.add('ar-flash');
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
}
