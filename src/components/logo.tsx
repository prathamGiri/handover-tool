export function Logo({ size = 40 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/icons/icon.svg" width={size} height={size} alt="" className="rounded-[22%]" />
  );
}
