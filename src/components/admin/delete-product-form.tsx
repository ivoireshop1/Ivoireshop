"use client";

export function DeleteProductForm({ id, action }: { id: string; action: (formData: FormData) => void | Promise<void> }) {
  return (
    <form action={action} onSubmit={(event) => { if (!window.confirm("Delete this product? This cannot be undone.")) event.preventDefault(); }}>
      <input name="id" type="hidden" value={id} />
      <button className="text-sm text-[#7f1d1d] underline-offset-2 hover:underline" type="submit">Delete</button>
    </form>
  );
}
