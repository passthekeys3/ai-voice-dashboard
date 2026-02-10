import { toast as sonnerToast } from 'sonner';

/**
 * Toast notification utilities for consistent user feedback across the dashboard
 */

type ToastOptions = {
  description?: string;
  duration?: number;
};

type PromiseMessages<T> = {
  loading: string;
  success: string | ((data: T) => string);
  error: string | ((error: Error) => string);
};

/**
 * Show a success toast notification
 */
export function success(message: string, options?: ToastOptions) {
  return sonnerToast.success(message, {
    description: options?.description,
    duration: options?.duration ?? 4000,
  });
}

/**
 * Show an error toast notification
 */
export function error(message: string, options?: ToastOptions) {
  return sonnerToast.error(message, {
    description: options?.description,
    duration: options?.duration ?? 5000,
  });
}

/**
 * Show a warning toast notification
 */
export function warning(message: string, options?: ToastOptions) {
  return sonnerToast.warning(message, {
    description: options?.description,
    duration: options?.duration ?? 4000,
  });
}

/**
 * Show an info toast notification
 */
export function info(message: string, options?: ToastOptions) {
  return sonnerToast.info(message, {
    description: options?.description,
    duration: options?.duration ?? 4000,
  });
}

/**
 * Show a promise toast that updates based on the promise state
 * @example
 * toast.promise(saveData(), {
 *   loading: 'Saving...',
 *   success: 'Data saved!',
 *   error: 'Failed to save data',
 * });
 */
export function promise<T>(
  promiseOrFn: Promise<T> | (() => Promise<T>),
  messages: PromiseMessages<T>
) {
  return sonnerToast.promise(promiseOrFn, {
    loading: messages.loading,
    success: messages.success,
    error: messages.error,
  });
}

/**
 * Dismiss a specific toast or all toasts
 */
export function dismiss(toastId?: string | number) {
  return sonnerToast.dismiss(toastId);
}

/**
 * Export all toast functions as a single object for convenient imports
 */
export const toast = {
  success,
  error,
  warning,
  info,
  promise,
  dismiss,
};

export default toast;
