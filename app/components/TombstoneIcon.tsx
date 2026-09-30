// Headstone with a cross, used for the graveyard link and page
export default function TombstoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M6.5 20V10a5.5 5.5 0 0 1 11 0v10M4 20h16M12 9v6M9.5 11.5h5" />
    </svg>
  );
}
