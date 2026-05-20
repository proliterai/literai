import { browser } from '$app/environment';

type Params = { src: string; rootMargin?: string };

export function lazyImage(node: HTMLImageElement, params: Params) {
  if (!browser) return;

  const { src, rootMargin = '200px' } = params;
  node.dataset.src = src;

  const obs = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const img = e.target as HTMLImageElement;
        const real = img.dataset.src;
        if (real) {
          img.src = real;
          delete img.dataset.src;
        }
        obs.unobserve(img);
      }
    },
    { rootMargin }
  );

  obs.observe(node);

  return {
    update(next: Params) {
      node.dataset.src = next.src;
    },
    destroy() {
      obs.disconnect();
    }
  };
}