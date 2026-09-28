import { STORE_CLOSED_MESSAGE } from "@/src/lib/store/constants";
import { isStoreOpen } from "@/src/lib/store/status";

export async function AnnouncementBar() {
  const open = await isStoreOpen();
  return (
    <div className="bg-forest-green px-4 py-2 text-xs font-medium text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-5 gap-y-1 lg:px-8">
        {open ? (
          <>
            <span className="hidden text-white/75 sm:inline">Quality products</span>
            <span className="text-white/75">Secure checkout · Customer support</span>
          </>
        ) : (
          <span>{STORE_CLOSED_MESSAGE}</span>
        )}
      </div>
    </div>
  );
}
