import React, { useState } from 'react';

const CoffeeSampleGrading = ({ altitude, onSubmit, isDarkMode }) => {
  const [form, setForm] = useState({
    bag_weight: '',
    processing_method: '',
    colors: '',
    moisture: '',
    category_one_defects: '',
    category_two_defects: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const validate = () => {
    if (!form.bag_weight || form.bag_weight <= 0) return 'Bag weight must be positive.';
    if (form.processing_method === '') return 'Select a processing method.';
    if (form.colors === '') return 'Select a bean color.';
    if (!form.moisture || form.moisture < 0 || form.moisture > 20) return 'Moisture must be between 0 and 20.';
    if (form.category_one_defects === '' || form.category_one_defects < 0) return 'Category One defects must be 0 or more.';
    if (form.category_two_defects === '' || form.category_two_defects < 0) return 'Category Two defects must be 0 or more.';
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setResult(null);
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError('');
    setLoading(true);
    try {
      const params = new URLSearchParams({
        altitude: altitude || 0,
        bag_weight: form.bag_weight,
        processing_method: form.processing_method,
        colors: form.colors,
        moisture: form.moisture,
        category_one_defects: form.category_one_defects,
        category_two_defects: form.category_two_defects,
      });
      const response = await fetch(`http://127.0.0.1:7249/predict?${params.toString()}`);
      const data = await response.json();
      if (data.error) {
        setError(data.error);
        setResult(null);
      } else {
        setResult(data);
      }
    } catch (err) {
      setError('Failed to connect to the prediction API.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const bgClass = isDarkMode ? 'bg-gray-800' : 'bg-white';
  const textClass = isDarkMode ? 'text-white' : 'text-gray-900';
  const labelClass = isDarkMode ? 'text-gray-300' : 'text-gray-700';
  const inputClass = isDarkMode
    ? 'bg-gray-700 border-gray-600 text-white focus:border-green-500'
    : 'bg-white border-gray-300 text-gray-900 focus:border-green-500';
  const borderClass = isDarkMode ? 'border-gray-600' : 'border-gray-300';
  const errorClass = isDarkMode ? 'text-red-400' : 'text-red-600';
  const buttonClass = isDarkMode
    ? 'bg-green-700 hover:bg-green-600 text-white'
    : 'bg-green-600 hover:bg-green-700 text-white';
  const resultClass = isDarkMode ? 'bg-gray-900 text-green-300' : 'bg-green-50 text-green-700';

  return (
    <form
      onSubmit={handleSubmit}
      className={`max-w-md mx-auto p-6 rounded shadow space-y-4 ${bgClass}`}
    >
      <h2 className={`text-xl font-bold mb-2 ${textClass}`}>Coffee Sample Grading</h2>
      {error && <div className={`text-sm mb-2 ${errorClass}`}>{error}</div>}
      <div>
        <label className={`block mb-1 ${labelClass}`}>Bag Weight (kg)</label>
        <input type="number" name="bag_weight" value={form.bag_weight} onChange={handleChange} min="0.01" step="0.01" className={`w-full border rounded px-2 py-1 ${inputClass} ${borderClass}`} required />
      </div>
      <div>
        <label className={`block mb-1 ${labelClass}`}>Processing Method</label>
        <select name="processing_method" value={form.processing_method} onChange={handleChange} className={`w-full border rounded px-2 py-1 ${inputClass} ${borderClass}`} required>
          <option value="">Select method</option>
          <option value="0">Washed/Wet</option>
          <option value="1">Natural/Dry</option>
        </select>
      </div>
      <div>
        <label className={`block mb-1 ${labelClass}`}>Bean Color</label>
        <select name="colors" value={form.colors} onChange={handleChange} className={`w-full border rounded px-2 py-1 ${inputClass} ${borderClass}`} required>
          <option value="">Select color</option>
          <option value="0">Green</option>
          <option value="1">Bluish-Green</option>
          <option value="2">Blue-Green</option>
        </select>
      </div>
      <div>
        <label className={`block mb-1 ${labelClass}`}>Moisture (%)</label>
        <input type="number" name="moisture" value={form.moisture} onChange={handleChange} min="0" max="20" step="0.01" className={`w-full border rounded px-2 py-1 ${inputClass} ${borderClass}`} required />
      </div>
      <div>
        <label className={`block mb-1 ${labelClass}`}>Category One Defects</label>
        <input type="number" name="category_one_defects" value={form.category_one_defects} onChange={handleChange} min="0" step="1" className={`w-full border rounded px-2 py-1 ${inputClass} ${borderClass}`} required />
      </div>
      <div>
        <label className={`block mb-1 ${labelClass}`}>Category Two Defects</label>
        <input type="number" name="category_two_defects" value={form.category_two_defects} onChange={handleChange} min="0" step="1" className={`w-full border rounded px-2 py-1 ${inputClass} ${borderClass}`} required />
      </div>
      <button type="submit" className={`px-4 py-2 rounded ${buttonClass}`} disabled={loading}>
        {loading ? 'Predicting...' : 'Submit Sample'}
      </button>
      {result && (
        <div className={`mt-4 p-4 rounded ${resultClass}`}>
          <div className="font-semibold mb-2">Predicted Quality Grade:</div>
          <div className="text-lg font-bold">{result.predicted_quality_grade}</div>
        </div>
      )}
    </form>
  );
};

export default CoffeeSampleGrading; 