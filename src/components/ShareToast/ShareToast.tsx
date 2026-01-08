import { useFractalStore } from '../../store/fractalStore';

export function ShareToast() {
  const showShareToast = useFractalStore((state) => state.showShareToast);
  const shareToastMessage = useFractalStore((state) => state.shareToastMessage);

  if (!showShareToast) return null;

  const isSuccess = shareToastMessage.includes('copied');

  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 ${
        isSuccess ? 'bg-green-600' : 'bg-red-600'
      } text-white px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium z-50`}
    >
      {isSuccess ? (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      <span>{shareToastMessage}</span>
    </div>
  );
}
