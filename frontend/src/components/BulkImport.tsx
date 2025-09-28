import { useState, useEffect } from 'react';
import { resultsAPI } from '../lib/api';
import { ArrowUpTrayIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';

type FilePreview = {
  name: string;
  size: number;
  type: string;
  thumbnail?: string;
  isPdf: boolean;
} | null;

export default function BulkImport() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<FilePreview>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file size (10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (selectedFile.size > maxSize) {
      setMessage({ type: 'error', text: 'File size must be less than 10MB.' });
      setFile(null);
      setPreview(null);
      return;
    }

    // Validate file type
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/webp',
      'application/pdf'
    ];
    const isValidType = allowedTypes.includes(selectedFile.type) || selectedFile.name.toLowerCase().endsWith('.pdf');
    if (!isValidType) {
      setMessage({ type: 'error', text: 'Only PDF and image files (JPG, PNG, GIF, etc.) are allowed.' });
      setFile(null);
      setPreview(null);
      return;
    }

    setFile(selectedFile);
    setMessage(null);

    let thumbnail: string | undefined;
    const isPdf = selectedFile.type === 'application/pdf' || selectedFile.name.toLowerCase().endsWith('.pdf');
    if (!isPdf && selectedFile.type.startsWith('image/')) {
      thumbnail = URL.createObjectURL(selectedFile);
    }

    setPreview({
      name: selectedFile.name,
      size: selectedFile.size,
      type: selectedFile.type,
      thumbnail,
      isPdf
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !preview) return;

    setIsLoading(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await resultsAPI.bulkImportResults(formData);
      setMessage({
        type: 'success',
        text: `Successfully imported results from ${preview.name}. Processed: ${response.data.importedCount || 'unknown'}`
      });
      setPreview(null);
      setFile(null);
      // Clear file input
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Error importing results. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Cleanup thumbnail URL on unmount or file change
  useEffect(() => {
    return () => {
      if (preview?.thumbnail) {
        URL.revokeObjectURL(preview.thumbnail);
      }
    };
  }, [preview]);

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 pb-5">
        <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">Bulk Import Results</h3>
        <p className="mt-2 max-w-4xl text-sm text-gray-500 dark:text-gray-400">
          Upload a PDF or image file containing results. The backend will process and extract the data.
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Supported formats: PDF, JPG, PNG, GIF, BMP, WebP. File size up to 10MB.
        </p>
      </div>

      {message && (
        <div className={`rounded-md p-4 ${message.type === 'success' ? 'bg-green-50 dark:bg-green-900/30' : 'bg-red-50 dark:bg-red-900/30'}`}>
          <div className="flex">
            <div className="flex-shrink-0">
              {message.type === 'success' ? (
                <CheckIcon className="h-5 w-5 text-green-400" aria-hidden="true" />
              ) : (
                <XMarkIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
              )}
            </div>
            <div className="ml-3">
              <p className={`text-sm font-medium ${message.type === 'success' ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                {message.text}
              </p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="mt-1 flex justify-center rounded-md border-2 border-dashed border-gray-300 dark:border-gray-600 px-6 pt-5 pb-6">
          <div className="space-y-1 text-center">
            <ArrowUpTrayIcon className="mx-auto h-12 w-12 text-gray-400" aria-hidden="true" />
            <div className="flex text-sm text-gray-600 dark:text-gray-300">
              <label
                htmlFor="file-upload"
                className="relative cursor-pointer rounded-md bg-white dark:bg-gray-800 font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2"
              >
                <span>Upload a file</span>
                <input
                  id="file-upload"
                  name="file-upload"
                  type="file"
                  className="sr-only"
                  accept="image/*,.pdf"
                  onChange={handleFileChange}
                  disabled={isLoading}
                />
              </label>
              <p className="pl-1">or drag and drop</p>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">PDF or images up to 10MB</p>
          </div>
        </div>

        {preview && (
          <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
            <div className="bg-white dark:bg-gray-800 p-6">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Selected File Preview</h4>
              <div className="flex items-center space-x-4">
                {preview.thumbnail ? (
                  <img
                    src={preview.thumbnail}
                    alt={preview.name}
                    className="h-20 w-20 object-cover rounded-md"
                  />
                ) : (
                  <div className="h-20 w-20 bg-gray-200 dark:bg-gray-700 rounded-md flex items-center justify-center">
                    <ArrowUpTrayIcon className="h-8 w-8 text-gray-400" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{preview.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {preview.isPdf ? 'PDF' : preview.type.split('/')[1]?.toUpperCase() || 'Image'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {(preview.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!preview || isLoading}
            className={`inline-flex items-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              !preview || isLoading
                ? 'bg-indigo-300 dark:bg-indigo-800 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'
            }`}
          >
            {isLoading ? 'Importing...' : 'Import File'}
          </button>
        </div>
      </form>
    </div>
  );
}
