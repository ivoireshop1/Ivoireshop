export function AnnouncementBar() {
  return (
    <div className="bg-forest-green px-4 py-2 text-xs font-medium text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-5 gap-y-1 lg:px-8">
        <span>Free shipping on orders over $75</span>
        <span className="hidden text-white/75 sm:inline">Authentic African &amp; international products</span>
        <span className="text-white/75">Secure payments · Easy returns · Customer support</span>
      </div>
    </div>
  );
}
