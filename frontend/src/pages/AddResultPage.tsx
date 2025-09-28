import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { resultsAPI } from '../lib/api';
import { format } from 'date-fns';
import BulkImport from '../components/BulkImport';

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

const tabs = [
  { name: 'Add Single', current: true },
  { name: 'Bulk Import', current: false },
];

const AddResultPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('single');
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    open3: '',
    close3: '',
    middle: '',
    double: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tabs] = useState([
    { id: 'single', name: 'Add Single' },
    { id: 'bulk', name: 'Bulk Import' },
  ]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    // Validate number inputs
    if ((name === 'open3' || name === 'close3') && value.length <= 3) {
      if (/^\d*$/.test(value)) {
        setFormData(prev => ({ ...prev, [name]: value }));
      }
    } else if ((name === 'middle' || name === 'double') && value.length <= 2) {
      if (/^\d*$/.test(value)) {
        setFormData(prev => ({ ...prev, [name]: value }));
      }
    } else if (name === 'date') {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!formData.open3 || formData.open3.length !== 3) {
      setError('Please enter a valid 3-digit Open number');
      return;
    }
    
    if (!formData.close3 || formData.close3.length !== 3) {
      setError('Please enter a valid 3-digit Close number');
      return;
    }
    
    if (!formData.middle || formData.middle.length !== 2) {
      setError('Please enter a valid 2-digit Middle number');
      return;
    }
    
    if (!formData.double || formData.double.length !== 2) {
      setError('Please enter a valid 2-digit Double number');
      return;
    }
    
    try {
      setIsSubmitting(true);
      setError('');
      setSuccess('');
      
      await resultsAPI.addResult({
        date: formData.date,
        open3: formData.open3,
        close3: formData.close3,
        middle: formData.middle,
        double: formData.double,
      });
      
      setSuccess('Result added successfully!');
      
      // Reset form
      setFormData({
        date: format(new Date(), 'yyyy-MM-dd'),
        open3: '',
        close3: '',
        middle: '',
        double: '',
      });
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (err) {
      console.error('Error adding result:', err);
      setError('Failed to add result. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Add Results</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Add a single result or import multiple results at once.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={classNames(
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-600 dark:border-indigo-400 dark:text-indigo-300'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-500',
                'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm'
              )}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'single' && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
            <div className="sm:col-span-2">
              <label
                htmlFor="date"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Date
              </label>
              <div className="mt-1">
                <input
                  type="date"
                  name="date"
                  id="date"
                  value={formData.date}
                  onChange={handleChange}
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="open3"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Open (3D)
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  name="open3"
                  id="open3"
                  value={formData.open3}
                  onChange={handleChange}
                  placeholder="123"
                  maxLength={3}
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="close3"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Close (3D)
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  name="close3"
                  id="close3"
                  value={formData.close3}
                  onChange={handleChange}
                  placeholder="456"
                  maxLength={3}
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="middle"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Middle
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  name="middle"
                  id="middle"
                  value={formData.middle}
                  onChange={handleChange}
                  placeholder="78"
                  maxLength={2}
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="double"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Double
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  name="double"
                  id="double"
                  value={formData.double}
                  onChange={handleChange}
                  placeholder="90"
                  maxLength={2}
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 py-2 px-4 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : 'Save Result'}
            </button>
          </div>
        </form>
      )}

      {activeTab === 'bulk' && (
        <BulkImport />
      )}

      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-900/30 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="rounded-md bg-green-50 dark:bg-green-900/30 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-green-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                {success}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              <div className="sm:col-span-2">
                <label
                  htmlFor="date"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Date
                </label>
                <div className="mt-1">
                  <input
                    type="date"
                    name="date"
                    id="date"
                    value={formData.date}
                    onChange={handleChange}
                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="open3"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Open (3D)
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    name="open3"
                    id="open3"
                    value={formData.open3}
                    onChange={handleChange}
                    placeholder="123"
                    maxLength={3}
                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="close3"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Close (3D)
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    name="close3"
                    id="close3"
                    value={formData.close3}
                    onChange={handleChange}
                    placeholder="456"
                    maxLength={3}
                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="middle"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Middle
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    name="middle"
                    id="middle"
                    value={formData.middle}
                    onChange={handleChange}
                    placeholder="78"
                    maxLength={2}
                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="double"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Double
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    name="double"
                    id="double"
                    value={formData.double}
                    onChange={handleChange}
                    placeholder="90"
                    maxLength={2}
                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 py-2 px-4 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Saving...' : 'Save Result'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddResultPage;
