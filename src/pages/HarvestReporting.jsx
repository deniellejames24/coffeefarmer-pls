import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useTheme } from "../lib/ThemeContext";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Layout from '../components/Layout';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Move CoffeeSampleForm outside the main component to prevent re-creation
const CoffeeSampleForm = React.memo(({ harvestId, plantElevation, onSampleAdded, isDarkMode, editSample, onEditDone, compact, user, farmerDetails, onResultChange }) => {
  const [form, setForm] = useState({
    bag_weight: '',
    processing_method: '',
    colors: '',
    moisture: '',
    category_one_defects: '',
    category_two_defects: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  
  // Notify parent when result changes
  useEffect(() => {
    if (onResultChange) {
      onResultChange(result);
    }
  }, [result, onResultChange]);
  
  useEffect(() => {
    let isMounted = true;
    if (editSample && isMounted) {
      setForm({
        bag_weight: editSample.bag_weight,
        processing_method: editSample.processing_method,
        colors: editSample.colors,
        moisture: editSample.moisture,
        category_one_defects: editSample.category_one_defects,
        category_two_defects: editSample.category_two_defects,
      });
      setResult(editSample.predicted_quality_grade || null);
    }
    
    return () => {
      isMounted = false;
    };
  }, [editSample?.sample_id]);

  // Only clear form when editSample changes from something to null (editing done)
  const prevEditSampleRef = useRef(null);
  useEffect(() => {
    if (prevEditSampleRef.current && !editSample) {
      // editSample changed from something to null - clear form
      setForm({
        bag_weight: '',
        processing_method: '',
        colors: '',
        moisture: '',
        category_one_defects: '',
        category_two_defects: '',
      });
      setResult(null);
    }
    prevEditSampleRef.current = editSample;
  }, [editSample]);

  const handleChange = (e) => {
    // Clear the result when user starts typing (for new samples only)
    if (!editSample && result) {
      setResult(null);
    }
    setForm(prevForm => ({ ...prevForm, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);
    try {
      // 1. Call R API
      console.log('API Call - Plant Elevation:', plantElevation, 'Type:', typeof plantElevation);
      
      // Check if plant elevation is available
      if (!plantElevation) {
        console.warn('Plant elevation not available, using default value of 0');
      }
      
      const params = new URLSearchParams({
        ...form,
        altitude: plantElevation || 0,
      });
      console.log('API Call - Full params:', params.toString());
      const response = await fetch(`http://127.0.0.1:7249/predict?${params.toString()}`);
      const data = await response.json();
      if (data.predicted_quality_grade) {
        // Parse the grade if it's a JSON string like ["B"]
        let gradeToSet = data.predicted_quality_grade;
        if (typeof gradeToSet === 'string' && gradeToSet.startsWith('[') && gradeToSet.endsWith(']')) {
          try {
            const parsedGrade = JSON.parse(gradeToSet);
            gradeToSet = Array.isArray(parsedGrade) ? parsedGrade[0] : parsedGrade;
          } catch (e) {
            console.log(`Failed to parse JSON grade: "${gradeToSet}"`);
          }
        }
        console.log('Setting result to:', gradeToSet); // Debug log
        setResult(gradeToSet);
        if (editSample) {
          // Update existing sample
          const { error: updateError } = await supabase
            .from('coffee_samples')
            .update({
              ...form,
              predicted_quality_grade: data.predicted_quality_grade,
            })
            .eq('sample_id', editSample.sample_id);
          if (updateError) throw updateError;
          
          // Log sample update activity
          if (user && farmerDetails) {
            try {
              await supabase.from("activity_log").insert({
                user_id: user.id,
                farmer_id: farmerDetails.id,
                entity_type: "coffee_sample",
                entity_id: editSample.sample_id,
                action: "update",
                change_summary: `Updated coffee sample (${form.bag_weight}kg, Grade: ${data.predicted_quality_grade})`,
                old_data: JSON.stringify(editSample),
                new_data: JSON.stringify({ ...form, predicted_quality_grade: data.predicted_quality_grade })
              });
            } catch (logError) {
              console.error('Failed to log sample update activity:', logError);
              // Don't throw error - sample update was successful, just logging failed
            }
          }
          
          // Show success message for edited sample
          toast.success(`Sample updated successfully! New Grade: ${data.predicted_quality_grade}`);
          
          if (onEditDone) onEditDone();
        } else {
          // Insert new sample
          const { data: newSampleData, error: insertError } = await supabase
            .from('coffee_samples')
            .insert({
              ...form,
              harvest_id: harvestId,
              predicted_quality_grade: data.predicted_quality_grade,
            })
            .select("*")
            .single();
          if (insertError) throw insertError;
          
          // Log sample creation activity
          if (user && farmerDetails) {
            try {
              await supabase.from("activity_log").insert({
                user_id: user.id,
                farmer_id: farmerDetails.id,
                entity_type: "coffee_sample",
                entity_id: newSampleData.sample_id,
                action: "create",
                change_summary: `Added coffee sample (${form.bag_weight}kg, Grade: ${data.predicted_quality_grade})`,
                old_data: null,
                new_data: JSON.stringify(newSampleData)
              });
            } catch (logError) {
              console.error('Failed to log sample creation activity:', logError);
              // Don't throw error - sample creation was successful, just logging failed
            }
          }
          
          // Show success message for new sample
          toast.success(`Sample added successfully! Grade: ${data.predicted_quality_grade}`);
        }
        if (onSampleAdded) onSampleAdded();
        
        // Keep the result visible for 10 seconds before clearing
        if (!editSample) {
          setTimeout(() => {
            setForm({
              bag_weight: '',
              processing_method: '',
              colors: '',
              moisture: '',
              category_one_defects: '',
              category_two_defects: '',
            });
            setResult(null);
          }, 10000); // Keep result visible for 10 seconds
        }
      } else {
        setError(data.error || 'Prediction failed');
      }
    } catch (err) {
      setError('API call or save failed');
    } finally {
      setLoading(false);
    }
  };

  const bgClass = isDarkMode ? 'bg-gray-800' : 'bg-white';
  const textClass = isDarkMode ? 'text-white' : 'text-gray-900';
  const labelClass = isDarkMode ? 'text-gray-300' : 'text-gray-700';
  const inputClass = isDarkMode
    ? 'bg-gray-700 border-gray-600 text-white focus:border-green-500 focus:outline-none'
    : 'bg-white border-gray-300 text-gray-900 focus:border-green-500 focus:outline-none';
  const borderClass = isDarkMode ? 'border-gray-600' : 'border-gray-300';
  const errorClass = isDarkMode ? 'text-red-400' : 'text-red-600';
  const buttonClass = isDarkMode
    ? 'bg-green-700 hover:bg-green-600 text-white'
    : 'bg-green-600 hover:bg-green-700 text-white';
  const resultClass = isDarkMode ? 'bg-gray-900 text-green-300' : 'bg-green-50 text-green-700';

  return (
    <form
      onSubmit={handleSubmit}
      className={`w-full p-6 rounded-lg shadow-lg space-y-6 ${bgClass} border ${borderClass}`}
    >
      <h2 className={`text-xl font-bold mb-4 ${textClass}`}>
        {editSample ? 'Edit Coffee Sample' : 'Coffee Sample Grading'}
        {editSample && (
          <span className={`ml-2 text-sm font-normal ${isDarkMode ? 'text-blue-300' : 'text-blue-600'}`}>
            (Sample #{editSample.sample_id})
          </span>
        )}
      </h2>
      {error && <div className={`text-sm mb-4 p-3 rounded ${errorClass} bg-red-50 dark:bg-red-900/20`}>{error}</div>}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        <div>
          <label htmlFor="bag_weight" className={`block mb-1 text-xs ${labelClass}`}>Bag Weight (kg)</label>
          <input 
            id="bag_weight"
            type="number" 
            name="bag_weight" 
            value={form.bag_weight || ''} 
            onChange={handleChange} 
            min="0.01" 
            step="0.01" 
            className={`w-full border rounded px-2 py-1 text-sm ${inputClass} ${borderClass}`} 
            required 
          />
        </div>
        <div>
          <label htmlFor="processing_method" className={`block mb-1 text-xs ${labelClass}`}>Processing Method</label>
          <select 
            id="processing_method"
            name="processing_method" 
            value={form.processing_method || ''} 
            onChange={handleChange} 
            className={`w-full border rounded px-2 py-1 text-sm ${inputClass} ${borderClass}`} 
            required
          >
            <option value="">Select method</option>
            <option value="0">Washed/Wet</option>
            <option value="1">Natural/Dry</option>
          </select>
        </div>
        <div>
          <label htmlFor="colors" className={`block mb-1 text-xs ${labelClass}`}>Bean Color</label>
          <select 
            id="colors"
            name="colors" 
            value={form.colors || ''} 
            onChange={handleChange} 
            className={`w-full border rounded px-2 py-1 text-sm ${inputClass} ${borderClass}`} 
            required
          >
            <option value="">Select color</option>
            <option value="0">Green</option>
            <option value="1">Bluish-Green</option>
            <option value="2">Blue-Green</option>
          </select>
        </div>
        <div>
          <label htmlFor="moisture" className={`block mb-1 text-xs ${labelClass}`}>Moisture (%)</label>
          <input 
            id="moisture"
            type="number" 
            name="moisture" 
            value={form.moisture || ''} 
            onChange={handleChange} 
            min="0" 
            max="20" 
            step="0.01" 
            className={`w-full border rounded px-2 py-1 text-sm ${inputClass} ${borderClass}`} 
            required 
          />
        </div>
        <div>
          <label htmlFor="category_one_defects" className={`block mb-1 text-xs ${labelClass}`}>Category One Defects</label>
          <input 
            id="category_one_defects"
            type="number" 
            name="category_one_defects" 
            value={form.category_one_defects || ''} 
            onChange={handleChange} 
            min="0" 
            step="1" 
            className={`w-full border rounded px-2 py-1 text-sm ${inputClass} ${borderClass}`} 
            required 
          />
        </div>
        <div>
          <label htmlFor="category_two_defects" className={`block mb-1 text-xs ${labelClass}`}>Category Two Defects</label>
          <input 
            id="category_two_defects"
            type="number" 
            name="category_two_defects" 
            value={form.category_two_defects || ''} 
            onChange={handleChange} 
            min="0" 
            step="1" 
            className={`w-full border rounded px-2 py-1 text-sm ${inputClass} ${borderClass}`} 
            required 
          />
        </div>
        <div className="flex items-end">
          <button type="submit" className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${buttonClass}`} disabled={loading}>
            {loading ? (
              <div className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Predicting...
              </div>
            ) : (
              editSample ? 'Update' : 'Add'
            )}
          </button>
          {editSample && (
            <button 
              type="button" 
              onClick={onEditDone}
              className={`ml-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                isDarkMode 
                  ? 'bg-gray-600 hover:bg-gray-500 text-white' 
                  : 'bg-gray-500 hover:bg-gray-600 text-white'
              }`}
            >
              Cancel
            </button>
          )}
        </div>
      </div>

    </form>
  );
});
CoffeeSampleForm.displayName = 'CoffeeSampleForm';

// Move SampleList outside the main component to prevent re-creation
const SampleList = React.memo(({ harvestId, onSamplesChanged, isDarkMode, onTotalsCalculated, onEditSample, modalEditingSample, user, farmerDetails }) => {
  const [samples, setSamples] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchSamples = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('coffee_samples')
        .select('*')
        .eq('harvest_id', harvestId);
      if (!error && isMounted) {
        setSamples(data || []);
        if (onSamplesChanged) onSamplesChanged(data || []);
        // Calculate totals and notify parent
        const totals = { premium: 0, fine: 0, commercial: 0 };
        data?.forEach(sample => {
          const bagWeight = Number(sample.bag_weight) || 0;
          console.log(`Sample ${sample.sample_id}: Grade="${sample.predicted_quality_grade}", Weight=${bagWeight}`); // Debug log
          
          // More comprehensive grade matching - handle all possible formats including JSON strings
          let grade = sample.predicted_quality_grade?.toString().toLowerCase().trim();
          console.log(`Processing grade: "${grade}" for sample ${sample.sample_id}`);
          
          // Handle JSON string format like ["B"] or ["C"]
          if (grade.startsWith('[') && grade.endsWith(']')) {
            try {
              const parsedGrade = JSON.parse(grade);
              grade = Array.isArray(parsedGrade) ? parsedGrade[0]?.toString().toLowerCase() : parsedGrade?.toString().toLowerCase();
              console.log(`Parsed JSON grade: "${grade}"`);
            } catch (e) {
              console.log(`Failed to parse JSON grade: "${grade}"`);
            }
          }
          
          // Based on R API, the model likely returns: "A", "B", "C" or similar
          if (grade === 'b' || grade === 'premium' || grade === 'premium grade' || grade === 'premium grade b' || grade === 'grade b') {
            totals.premium += bagWeight;
            console.log(`Added ${bagWeight} to premium (total: ${totals.premium})`);
          } else if (grade === 'a' || grade === 'fine' || grade === 'fine grade' || grade === 'fine grade a' || grade === 'grade a') {
            totals.fine += bagWeight;
            console.log(`Added ${bagWeight} to fine (total: ${totals.fine})`);
          } else if (grade === 'c' || grade === 'commercial' || grade === 'commercial grade' || grade === 'commercial grade c' || grade === 'grade c') {
            totals.commercial += bagWeight;
            console.log(`Added ${bagWeight} to commercial (total: ${totals.commercial})`);
          } else {
            console.log(`Unknown grade: "${sample.predicted_quality_grade}" for sample ${sample.sample_id}`);
            // Add to commercial as fallback
            totals.commercial += bagWeight;
            console.log(`Added ${bagWeight} to commercial as fallback (total: ${totals.commercial})`);
          }
        });
        
        console.log('SampleList calculated totals:', totals); // Debug log
        if (onTotalsCalculated) onTotalsCalculated(totals);
      }
      if (isMounted) {
        setLoading(false);
      }
    };
    if (harvestId) fetchSamples();
    
    return () => {
      isMounted = false;
    };
  }, [harvestId, onSamplesChanged, onTotalsCalculated]);

  const handleDelete = async (sampleId) => {
    // Fetch the sample data before deletion for logging
    const { data: sampleToDelete } = await supabase
      .from('coffee_samples')
      .select('*')
      .eq('sample_id', sampleId)
      .single();
    
    // Delete the sample
    await supabase.from('coffee_samples').delete().eq('sample_id', sampleId);
    
    // Log sample deletion activity
    if (sampleToDelete && user && farmerDetails) {
      await supabase.from("activity_log").insert({
        user_id: user.id,
        farmer_id: farmerDetails.id,
        entity_type: "coffee_sample",
        entity_id: sampleId,
        action: "delete",
        change_summary: `Deleted coffee sample (${sampleToDelete.bag_weight}kg, Grade: ${sampleToDelete.predicted_quality_grade})`,
        old_data: JSON.stringify(sampleToDelete),
        new_data: null
      });
    }
    // Re-fetch samples
    const { data } = await supabase
      .from('coffee_samples')
      .select('*')
      .eq('harvest_id', harvestId);
    setSamples(data || []);
    if (onSamplesChanged) onSamplesChanged(data || []);
    // Recalculate totals
    const totals = { premium: 0, fine: 0, commercial: 0 };
    data?.forEach(sample => {
      const bagWeight = Number(sample.bag_weight) || 0;
      // More comprehensive grade matching - handle all possible formats including JSON strings
      let grade = sample.predicted_quality_grade?.toString().toLowerCase().trim();
      console.log(`Processing grade: "${grade}" for sample ${sample.sample_id}`);
      
      // Handle JSON string format like ["B"] or ["C"]
      if (grade.startsWith('[') && grade.endsWith(']')) {
        try {
          const parsedGrade = JSON.parse(grade);
          grade = Array.isArray(parsedGrade) ? parsedGrade[0]?.toString().toLowerCase() : parsedGrade?.toString().toLowerCase();
          console.log(`Parsed JSON grade: "${grade}"`);
        } catch (e) {
          console.log(`Failed to parse JSON grade: "${grade}"`);
        }
      }
      
      // Based on R API, the model likely returns: "A", "B", "C" or similar
      if (grade === 'b' || grade === 'premium' || grade === 'premium grade' || grade === 'premium grade b' || grade === 'grade b') {
        totals.premium += bagWeight;
        console.log(`Added ${bagWeight} to premium (total: ${totals.premium})`);
      } else if (grade === 'a' || grade === 'fine' || grade === 'fine grade' || grade === 'fine grade a' || grade === 'grade a') {
        totals.fine += bagWeight;
        console.log(`Added ${bagWeight} to fine (total: ${totals.fine})`);
      } else if (grade === 'c' || grade === 'commercial' || grade === 'commercial grade' || grade === 'commercial grade c' || grade === 'grade c') {
        totals.commercial += bagWeight;
        console.log(`Added ${bagWeight} to commercial (total: ${totals.commercial})`);
      } else {
        console.log(`Unknown grade: "${sample.predicted_quality_grade}" for sample ${sample.sample_id}`);
        // Add to commercial as fallback
        totals.commercial += bagWeight;
        console.log(`Added ${bagWeight} to commercial as fallback (total: ${totals.commercial})`);
      }
    });
    console.log('SampleList recalculated totals after delete:', totals); // Debug log
    if (onTotalsCalculated) onTotalsCalculated(totals);
  };

  // Enhanced theme classes for better consistency
  const bgClass = isDarkMode ? 'bg-gray-800' : 'bg-white';
  const textClass = isDarkMode ? 'text-white' : 'text-gray-900';
  const borderClass = isDarkMode ? 'border-gray-600' : 'border-gray-300';
  const headerBgClass = isDarkMode ? 'bg-gray-700' : 'bg-gray-100';
  const headerTextClass = isDarkMode ? 'text-gray-200' : 'text-gray-700';
  const rowBgClass = isDarkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-50';
  const loadingTextClass = isDarkMode ? 'text-gray-400' : 'text-gray-500';
  const editButtonClass = isDarkMode 
    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
    : 'bg-blue-100 hover:bg-blue-200 text-blue-700';
  const deleteButtonClass = isDarkMode 
    ? 'bg-red-600 hover:bg-red-700 text-white' 
    : 'bg-red-100 hover:bg-red-200 text-red-700';

  return (
    <div className={`mt-4 p-4 rounded-lg shadow-lg ${bgClass} border ${borderClass}`}>
      <h4 className={`text-lg font-bold mb-4 ${textClass}`}>Samples for this Harvest</h4>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead>
            <tr className={`${headerBgClass} ${headerTextClass}`}>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Bag Weight (kg)</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Grade</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Date Graded</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Processing</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Color</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Moisture</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Defects 1</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Defects 2</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className={`${bgClass} divide-y divide-gray-200 dark:divide-gray-700`}>
            {loading ? (
              <tr>
                <td colSpan={9} className={`px-4 py-6 text-center ${loadingTextClass}`}>
                  <div className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading samples...
                  </div>
                </td>
              </tr>
            ) : samples.length === 0 ? (
              <tr>
                <td colSpan={9} className={`px-4 py-6 text-center ${loadingTextClass}`}>
                  <div className="flex flex-col items-center">
                    <svg className="w-8 h-8 mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                    </svg>
                    No samples recorded yet
                  </div>
                </td>
              </tr>
            ) : (
              samples.map((sample, index) => {
                // Check if this is a recently added sample (within last 10 seconds)
                const isRecentSample = sample.created_at && 
                  (new Date() - new Date(sample.created_at)) < 10000; // 10 seconds
                
                return (
                  <tr key={sample.sample_id} className={`${rowBgClass} transition-colors duration-150 ${textClass} ${isRecentSample ? 'ring-2 ring-green-300 dark:ring-green-600' : ''} ${modalEditingSample?.sample_id === sample.sample_id ? 'ring-2 ring-blue-300 dark:ring-blue-600 bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center space-x-2">
                        <span>{sample.bag_weight}</span>
                        {isRecentSample && (
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            New
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        sample.predicted_quality_grade === 'Premium' || sample.predicted_quality_grade === 'B' 
                          ? (isDarkMode ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-800')
                          : sample.predicted_quality_grade === 'Fine' || sample.predicted_quality_grade === 'A'
                          ? (isDarkMode ? 'bg-blue-900 text-blue-200' : 'bg-blue-100 text-blue-800')
                          : (isDarkMode ? 'bg-yellow-900 text-yellow-200' : 'bg-yellow-100 text-yellow-800')
                      }`}>
                        {(() => {
                          let grade = sample.predicted_quality_grade;
                          
                          // Handle JSON array format like ["A"], ["B"], ["C"]
                          if (typeof grade === 'string' && grade.startsWith('[') && grade.endsWith(']')) {
                            try {
                              const parsedGrade = JSON.parse(grade);
                              grade = Array.isArray(parsedGrade) ? parsedGrade[0] : parsedGrade;
                            } catch (e) {
                              console.log(`Failed to parse JSON grade: "${grade}"`);
                            }
                          }
                          
                          // Convert to string and normalize
                          grade = grade?.toString().toUpperCase();
                          
                          if (grade === 'A' || grade === 'FINE') return 'Fine';
                          if (grade === 'B' || grade === 'PREMIUM') return 'Premium';
                          if (grade === 'C' || grade === 'COMMERCIAL') return 'Commercial';
                          return grade || 'Unknown';
                        })()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {sample.created_at ? new Date(sample.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : '-'}
                    </td>
                  <td className="px-4 py-3 text-sm">{sample.processing_method === 0 ? 'Washed' : 'Natural'}</td>
                  <td className="px-4 py-3 text-sm">{['Green','Bluish-Green','Blue-Green'][sample.colors]}</td>
                  <td className="px-4 py-3 text-sm">{sample.moisture}%</td>
                  <td className="px-4 py-3 text-sm">{sample.category_one_defects}</td>
                  <td className="px-4 py-3 text-sm">{sample.category_two_defects}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex space-x-2">
                      <button 
                        className={`group relative px-3 py-2 text-xs font-medium rounded-lg transition-all duration-200 hover:scale-105 ${modalEditingSample?.sample_id === sample.sample_id ? 'bg-green-600 hover:bg-green-700 text-white' : editButtonClass} hover:shadow-md`}
                        onClick={() => onEditSample(sample)}
                        title={modalEditingSample?.sample_id === sample.sample_id ? "Currently editing this sample" : "Edit this coffee sample"}
                      >
                        <div className="flex items-center space-x-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          <span>{modalEditingSample?.sample_id === sample.sample_id ? 'Editing...' : 'Edit Sample'}</span>
                        </div>
                        {/* Hover tooltip */}
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                          Click to edit this sample
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                        </div>
                      </button>
                      <button 
                        className={`group relative px-3 py-2 text-xs font-medium rounded-lg transition-all duration-200 hover:scale-105 ${deleteButtonClass} hover:shadow-md`}
                        onClick={() => {
                          if (window.confirm('Are you sure you want to delete this sample? This action cannot be undone.')) {
                            handleDelete(sample.sample_id);
                          }
                        }}
                        title="Delete this coffee sample"
                      >
                        <div className="flex items-center space-x-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          <span>Delete</span>
                        </div>
                        {/* Hover tooltip */}
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                          Delete this sample permanently
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                        </div>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});
SampleList.displayName = 'SampleList';

const HarvestReporting = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDarkMode, toggleTheme } = useTheme();
  const initialLoadDone = useRef(false);

  // Add global styles for dark mode select options
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .dark-mode select option {
        background-color: #374151 !important;
        color: white !important;
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // Add dark mode class to body when dark mode is active
  React.useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [isDarkMode]);

  const [user, setUser] = useState(null);
  const [farmerDetails, setFarmerDetails] = useState(null); // Will hold the current farmer's details
  const [plantDataList, setPlantDataList] = useState([]); // To populate the plant_id dropdown
  const [harvestDataList, setHarvestDataList] = useState([]);
  const [selectedYear, setSelectedYear] = useState('All');
  const [yearSortOrder, setYearSortOrder] = useState('desc'); // 'desc' for Newest to Oldest, 'asc' for Oldest to Newest
  const [selectedCluster, setSelectedCluster] = useState('All'); // Filter by cluster ID
  const [harvestInputForm, setHarvestInputForm] = useState({
    harvest_id: null, // null for new entry, ID for editing
    farmer_id: null,
    plant_id: "", // Make sure this is initially an empty string for the select input
    harvest_date: "",
    coffee_raw_quantity: "", // NEW NAME (float8)
    coffee_dry_quantity: "", // NEW NAME (float8)
    coffee_premium_grade: "", // NEW GRADE FIELD (float8)
    coffee_fine_grade: "", // NEW GRADE FIELD (float8)
    coffee_commercial_grade: "", // NEW GRADE FIELD (float8)
  });
  const [showHarvestForm, setShowHarvestForm] = useState(false);
  const [isEditingHarvest, setIsEditingHarvest] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // PDF preview modal state
  const [isPdfPreviewOpen, setIsPdfPreviewOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const pdfDocRef = useRef(null);

  // Add new state for maximum dry quantity
  const [maxDryQuantity, setMaxDryQuantity] = useState(0);

  // Add state to track the current harvestId and grade totals
  const [currentHarvestId, setCurrentHarvestId] = useState(null);
  const [gradeTotals, setGradeTotals] = useState({ premium: 0, fine: 0, commercial: 0 });

  // Add state for editing sample
  const [editingSample, setEditingSample] = useState(null);

  // Add modal state at the top of the component
  const [isSampleModalOpen, setIsSampleModalOpen] = useState(false);
  const [modalHarvestId, setModalHarvestId] = useState(null);
  const [modalEditingSample, setModalEditingSample] = useState(null);
  const [sampleUpdateCounter, setSampleUpdateCounter] = useState(0); // Force refresh of SampleList
  const [sampleResult, setSampleResult] = useState(null); // Track sample result for display in header

  // Memoized callback functions - make them more stable
  const handleSamplesChanged = useCallback(() => {}, []);
  
  const handleTotalsCalculated = useCallback(async (totals) => {
    console.log('Calculated totals:', totals); // Debug log
    setGradeTotals(totals);
    if (modalHarvestId) {
      const totalDryQuantity = totals.premium + totals.fine + totals.commercial;
      
      console.log(`Updating harvest ${modalHarvestId} with totals:`, {
        coffee_premium_grade: totals.premium,
        coffee_fine_grade: totals.fine,
        coffee_commercial_grade: totals.commercial,
        coffee_dry_quantity: totalDryQuantity
      });
      
      // Update the harvest record with the calculated totals
      const { error: updateError } = await supabase.from('harvest_data').update({
        coffee_premium_grade: totals.premium,
        coffee_fine_grade: totals.fine,
        coffee_commercial_grade: totals.commercial,
        coffee_dry_quantity: totalDryQuantity,
      }).eq('harvest_id', modalHarvestId);

      if (updateError) {
        console.error('Error updating harvest totals:', updateError);
        toast.error('Failed to update harvest totals');
      } else {
        console.log('Successfully updated harvest totals in database'); // Debug log
        
        // Log grade totals update activity
        if (user && farmerDetails) {
          await supabase.from("activity_log").insert({
            user_id: user.id,
            farmer_id: farmerDetails.id,
            entity_type: "harvest_grades",
            entity_id: modalHarvestId,
            action: "update",
            change_summary: `Updated grade totals: Premium ${totals.premium.toFixed(2)}kg, Fine ${totals.fine.toFixed(2)}kg, Commercial ${totals.commercial.toFixed(2)}kg (Total: ${totalDryQuantity.toFixed(2)}kg)`,
            old_data: null, // We don't have the old totals easily available
            new_data: JSON.stringify({
              premium_grade: totals.premium,
              fine_grade: totals.fine,
              commercial_grade: totals.commercial,
              total_dry_quantity: totalDryQuantity
            })
          });
        }
        
        // Verify the update by fetching the updated record
        const { data: updatedHarvest, error: fetchError } = await supabase
          .from('harvest_data')
          .select('coffee_premium_grade, coffee_fine_grade, coffee_commercial_grade, coffee_dry_quantity')
          .eq('harvest_id', modalHarvestId)
          .single();
          
        if (!fetchError && updatedHarvest) {
          console.log('Database verification - Updated harvest data:', updatedHarvest);
        }
        
        // Update the local harvest data list to reflect changes
        setHarvestDataList(prevList => 
          prevList.map(harvest => 
            harvest.harvest_id === modalHarvestId 
              ? { 
                  ...harvest, 
                  coffee_premium_grade: totals.premium,
                  coffee_fine_grade: totals.fine,
                  coffee_commercial_grade: totals.commercial,
                  coffee_dry_quantity: totalDryQuantity
                }
              : harvest
          )
        );
        toast.success(`Grade totals updated: ${totalDryQuantity.toFixed(2)} kg total`);
      }
    }
  }, [modalHarvestId]);

  const handleEditSample = useCallback((sample) => {
    setModalEditingSample(sample);
  }, []);
  
  const handleSampleAdded = useCallback(() => { 
    setModalEditingSample(null);
    // Force refresh of samples list by incrementing the counter
    setSampleUpdateCounter(prev => prev + 1);
  }, []);
  
  const handleEditDone = useCallback(() => {
    setModalEditingSample(null);
  }, []);

  const handleSampleResultChange = useCallback((result) => {
    setSampleResult(result);
    // Clear result after 10 seconds
    if (result) {
      setTimeout(() => {
        setSampleResult(null);
      }, 10000);
    }
  }, []);

  // Function to initialize grade totals when modal opens
  const initializeGradeTotals = useCallback(async (harvestId) => {
    if (!harvestId) return;
    
    console.log('Initializing grade totals for harvest:', harvestId);
    
    try {
      // Fetch current samples for this harvest
      const { data: samples, error } = await supabase
        .from('coffee_samples')
        .select('*')
        .eq('harvest_id', harvestId);
      
      if (error) {
        console.error('Error fetching samples for grade totals:', error);
        return;
      }

      console.log('Fetched samples for harvest', harvestId, ':', samples);

      // Debug: Log all unique grade values to understand what the API returns
      const uniqueGrades = [...new Set(samples?.map(s => s.predicted_quality_grade) || [])];
      console.log('Unique grade values found:', uniqueGrades);

      // Calculate totals from samples
      const totals = { premium: 0, fine: 0, commercial: 0 };
      samples?.forEach(sample => {
        const bagWeight = Number(sample.bag_weight) || 0;
        console.log(`Processing sample ${sample.sample_id}: Grade="${sample.predicted_quality_grade}", Weight=${bagWeight}`);
        
        // More comprehensive grade matching - handle all possible formats including JSON strings
        let grade = sample.predicted_quality_grade?.toString().toLowerCase().trim();
        console.log(`Processing grade: "${grade}" for sample ${sample.sample_id}`);
        
        // Handle JSON string format like ["B"] or ["C"]
        if (grade.startsWith('[') && grade.endsWith(']')) {
          try {
            const parsedGrade = JSON.parse(grade);
            grade = Array.isArray(parsedGrade) ? parsedGrade[0]?.toString().toLowerCase() : parsedGrade?.toString().toLowerCase();
            console.log(`Parsed JSON grade: "${grade}"`);
          } catch (e) {
            console.log(`Failed to parse JSON grade: "${grade}"`);
          }
        }
        
        // Based on R API, the model likely returns: "A", "B", "C" or similar
        if (grade === 'b' || grade === 'premium' || grade === 'premium grade' || grade === 'premium grade b' || grade === 'grade b') {
          totals.premium += bagWeight;
          console.log(`Added ${bagWeight} to premium (total: ${totals.premium})`);
        } else if (grade === 'a' || grade === 'fine' || grade === 'fine grade' || grade === 'fine grade a' || grade === 'grade a') {
          totals.fine += bagWeight;
          console.log(`Added ${bagWeight} to fine (total: ${totals.fine})`);
        } else if (grade === 'c' || grade === 'commercial' || grade === 'commercial grade' || grade === 'commercial grade c' || grade === 'grade c') {
          totals.commercial += bagWeight;
          console.log(`Added ${bagWeight} to commercial (total: ${totals.commercial})`);
        } else {
          console.log(`Unknown grade: "${sample.predicted_quality_grade}" for sample ${sample.sample_id}`);
          // Add to commercial as fallback
          totals.commercial += bagWeight;
          console.log(`Added ${bagWeight} to commercial as fallback (total: ${totals.commercial})`);
        }
      });

      console.log('Final initialized grade totals:', totals);
      setGradeTotals(totals);
    } catch (err) {
      console.error('Error initializing grade totals:', err);
    }
  }, []);

  useEffect(() => {
    const fetchUserAndData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }
      setUser(user);

      // Fetch user's role for navigation links
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("first_name, last_name, email, role")
        .eq("email", user.email)
        .single();
      if (!userError) setUser(prevUser => ({ ...prevUser, ...userData }));

      // Fetch farmer details (needed for farmer_id and farm_elevation)
      const { data: farmerData, error: farmerError } = await supabase
        .from("farmer_detail")
        .select("id, farm_elevation") // Need both ID and farm_elevation for API calls
        .eq("id", user.id)
        .single();

      if (farmerError && farmerError.code === 'PGRST116') { // No rows found
        if (!initialLoadDone.current) {
        toast.info("Please declare your farm details first in 'Land & Plant Declaration'.");
        }
        setFarmerDetails(null);
        setPlantDataList([]); // Clear plant list if no farmer details
        setHarvestDataList([]); // Clear harvest list if no farmer details
        return;
      } else if (farmerData) {
        console.log('Farmer details loaded:', farmerData);
        console.log('Farm elevation:', farmerData.farm_elevation);
        setFarmerDetails(farmerData);

        // Fetch plant data for this farmer (to populate the dropdown)
        const { data: plants, error: plantsError } = await supabase
          .from("plant_data")
          .select("plant_id, coffee_variety, planting_date")
          .eq("farmer_id", farmerData.id);

        if (!plantsError) {
          setPlantDataList(plants || []);
        } else {
          console.error("Error fetching plant data for dropdown:", plantsError);
          if (!initialLoadDone.current) {
            toast.error("Error loading data. Please try refreshing the page.");
          }
        }

        // Fetch harvest data for this farmer with plant information including elevation
        const { data: harvests, error: harvestsError } = await supabase
          .from("harvest_data")
          .select(`
            *,
            plant_data (
              plant_id,
              coffee_variety,
              elevation,
              cluster_size
            )
          `)
          .eq("farmer_id", farmerData.id)
          .order("harvest_date", { ascending: false }); // Order by date

        if (!harvestsError) {
          setHarvestDataList(harvests || []);
          console.log('Harvest data with plant elevation:', harvests);
          if (!initialLoadDone.current) {
            const plantCount = plants?.length || 0;
            const harvestCount = harvests?.length || 0;
            if (plantCount === 0) {
              toast.info("No plant data found. Please add plants in 'Land & Plant Declaration'.");
            } else if (harvestCount === 0) {
              toast.info("No harvest data recorded yet. You can start adding harvest records.");
            } else {
              toast.success(`Loaded ${plantCount} plant record${plantCount > 1 ? 's' : ''} and ${harvestCount} harvest record${harvestCount > 1 ? 's' : ''}.`);
            }
          }
        } else {
          console.error("Error fetching harvest data:", harvestsError);
          if (!initialLoadDone.current) {
            toast.error("Error loading data. Please try refreshing the page.");
          }
        }
      } else if (farmerError) {
        console.error("Error fetching farmer details:", farmerError);
        if (!initialLoadDone.current) {
          toast.error("Error loading data. Please try refreshing the page.");
        }
      }
      initialLoadDone.current = true;
    };
    fetchUserAndData();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const handleHarvestInputChange = (e) => {
    const { name, value } = e.target;
    
    // Update the form state
    setHarvestInputForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Calculate max dry quantity when raw quantity changes (approximately 20% weight loss during drying)
    if (name === 'coffee_raw_quantity') {
      const rawQuantity = parseFloat(value) || 0;
      const maxDry = Math.round((rawQuantity * 1) * 100) / 100; // Round to 2 decimal places
      setMaxDryQuantity(maxDry);
    }

    // Calculate total dry quantity from grades
    if (['coffee_premium_grade', 'coffee_fine_grade', 'coffee_commercial_grade'].includes(name)) {
      const premiumGrade = parseFloat(name === 'coffee_premium_grade' ? value : harvestInputForm.coffee_premium_grade) || 0;
      const fineGrade = parseFloat(name === 'coffee_fine_grade' ? value : harvestInputForm.coffee_fine_grade) || 0;
      const commercialGrade = parseFloat(name === 'coffee_commercial_grade' ? value : harvestInputForm.coffee_commercial_grade) || 0;
      
      const calculatedDryQuantity = premiumGrade + fineGrade + commercialGrade;
      
      // Update the dry quantity
      setHarvestInputForm((prev) => ({
        ...prev,
        coffee_dry_quantity: calculatedDryQuantity.toFixed(2),
      }));
    }
  };

  const saveHarvestData = async (e) => {
    e.preventDefault();

    if (!farmerDetails || !farmerDetails.id) {
      toast.error("Farmer details not loaded. Cannot save harvest data.");
      return;
    }

    if (!harvestInputForm.harvest_date || !harvestInputForm.plant_id || harvestInputForm.coffee_raw_quantity === "") {
      toast.warning("Please fill all required harvest data fields.");
      return;
    }

    const parsedRawQuantity = parseFloat(harvestInputForm.coffee_raw_quantity);
    if (isNaN(parsedRawQuantity) || parsedRawQuantity < 0) {
      toast.warning("Raw coffee quantity must be a non-negative number.");
      return;
    }

    // Only use plant_id, harvest_date, coffee_raw_quantity for new harvest
    const harvestDataToSave = {
      plant_id: harvestInputForm.plant_id,
      harvest_date: harvestInputForm.harvest_date,
      coffee_raw_quantity: parsedRawQuantity,
      farmer_id: farmerDetails.id,
    };

    try {
      let newHarvest;
      if (harvestInputForm.harvest_id) {
        // Update existing record
        const { data: oldHarvest } = await supabase
          .from("harvest_data")
          .select("*")
          .eq("harvest_id", harvestInputForm.harvest_id)
          .single();
        const { error: updateError } = await supabase
          .from("harvest_data")
          .update(harvestDataToSave)
          .eq("harvest_id", harvestInputForm.harvest_id)
          .eq("farmer_id", farmerDetails.id);
        if (updateError) throw updateError;
        await supabase.from("activity_log").insert({
          user_id: user.id,
          farmer_id: farmerDetails.id,
          entity_type: "harvest",
          entity_id: harvestInputForm.harvest_id,
          action: "update",
          change_summary: `Updated harvest (${harvestInputForm.harvest_date})`,
          old_data: JSON.stringify(oldHarvest),
          new_data: JSON.stringify({ ...oldHarvest, ...harvestDataToSave })
        });
        toast.success("Harvest data updated successfully!");
        newHarvest = { harvest_id: harvestInputForm.harvest_id };
      } else {
        // Insert new record
        const { data: newHarvestData, error: insertError } = await supabase
          .from("harvest_data")
          .insert(harvestDataToSave)
          .select("*")
          .single();
        if (insertError) throw insertError;
        await supabase.from("activity_log").insert({
          user_id: user.id,
          farmer_id: farmerDetails.id,
          entity_type: "harvest",
          entity_id: newHarvestData.harvest_id,
          action: "create",
          change_summary: `Created harvest (${harvestInputForm.harvest_date})`,
          old_data: null,
          new_data: JSON.stringify(newHarvestData)
        });
        toast.success("Harvest data added successfully!");
        newHarvest = newHarvestData;
      }

      // Re-fetch all harvest data to update the list
      const { data: updatedHarvestList, error: fetchError } = await supabase
        .from("harvest_data")
        .select("*")
        .eq("farmer_id", farmerDetails.id)
        .order("harvest_date", { ascending: false });
      if (fetchError) throw fetchError;
      setHarvestDataList(updatedHarvestList || []);

      // Set currentHarvestId for sample grading
      setCurrentHarvestId(newHarvest.harvest_id);

      // Close modal and reset form after successful save
      if (isEditingHarvest) {
        setIsModalOpen(false);
        setIsEditingHarvest(false);
      }
      setHarvestInputForm({
        harvest_id: null,
        farmer_id: farmerDetails?.id,
        plant_id: "",
        harvest_date: "",
        coffee_raw_quantity: "",
        coffee_dry_quantity: "",
        coffee_premium_grade: "",
        coffee_fine_grade: "",
        coffee_commercial_grade: "",
      });
    } catch (error) {
      console.error("Error saving harvest data:", error);
      toast.error(`Error saving harvest data: ${error.message}`);
    }
  };

  const editHarvest = (harvest) => {
    setHarvestInputForm({
      harvest_id: harvest.harvest_id,
      farmer_id: harvest.farmer_id,
      plant_id: harvest.plant_id,
      harvest_date: harvest.harvest_date.split('T')[0], // Format for date input
      coffee_raw_quantity: harvest.coffee_raw_quantity,
      coffee_dry_quantity: harvest.coffee_dry_quantity,
      coffee_premium_grade: harvest.coffee_premium_grade,
      coffee_fine_grade: harvest.coffee_fine_grade,
      coffee_commercial_grade: harvest.coffee_commercial_grade,
    });
    setIsEditingHarvest(true);
    setIsModalOpen(true);
    // Set maxDryQuantity based on the raw quantity of the record being edited
    setMaxDryQuantity(Number(harvest.coffee_raw_quantity) || 0);
  };

  const deleteHarvest = async (harvestId) => {
    // Fetch old data for logging
    const oldHarvest = harvestDataList.find(h => h.harvest_id === harvestId);
    if (!window.confirm("Are you sure you want to delete this harvest entry?")) return;

    try {
      const { error } = await supabase
        .from("harvest_data")
        .delete()
        .eq("harvest_id", harvestId)
        .eq("farmer_id", farmerDetails.id); // Ensure user can only delete their own records

      if (error) throw error;

      // Log delete
      await supabase.from("activity_log").insert({
        user_id: user.id,
        farmer_id: farmerDetails.id,
        entity_type: "harvest",
        entity_id: harvestId,
        action: "delete",
        change_summary: `Deleted harvest (${oldHarvest?.harvest_date || 'Unknown'})`,
        old_data: JSON.stringify(oldHarvest),
        new_data: null
      });

      toast.success("Harvest data deleted successfully!");
      setHarvestDataList(harvestDataList.filter(harvest => harvest.harvest_id !== harvestId));

      // If the deleted harvest was being edited, reset the form
      if (harvestInputForm.harvest_id === harvestId) {
        setHarvestInputForm({
          harvest_id: null,
          farmer_id: farmerDetails.id,
          plant_id: "",
          harvest_date: "",
          coffee_raw_quantity: "",
          coffee_dry_quantity: "",
          coffee_premium_grade: "",
          coffee_fine_grade: "",
          coffee_commercial_grade: "",
        });
        setShowHarvestForm(false);
        setIsEditingHarvest(false);
      }
    } catch (error) {
      console.error("Error deleting harvest data:", error);
      toast.error(`Error deleting harvest data: ${error.message}`);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsEditingHarvest(false);
    setHarvestInputForm({
      harvest_id: null,
      farmer_id: farmerDetails?.id,
      plant_id: "",
      harvest_date: "",
      coffee_raw_quantity: "",
      coffee_dry_quantity: "",
      coffee_premium_grade: "",
      coffee_fine_grade: "",
      coffee_commercial_grade: "",
    });
  };

  const handleOutsideClick = (e) => {
    // If the click is on the overlay (data-input-section) but not on the modal content
    if (e.target.classList.contains('data-input-section')) {
      cancelHarvestEdit();
    }
  };

  const handleExportPDF = async () => {
    const doc = new jsPDF();
    // Title
    doc.setFontSize(18);
    doc.text('Harvest Report', 14, 18);
    // Date
    doc.setFontSize(10);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 26);
    // Farmer Name
    doc.setFontSize(12);
    let farmerName = user?.fullName || (user?.first_name ? `${user.first_name} ${user.last_name || ''}` : '');
    if (!farmerName && farmerDetails?.first_name) {
      farmerName = `${farmerDetails.first_name} ${farmerDetails.last_name || ''}`;
    }
    farmerName = farmerName.trim() || '-';
    doc.text(`Farmer: ${farmerName}`, 14, 34);
    // Table Section
    doc.setFontSize(14);
    doc.text('Harvest Records', 14, 44);
    doc.setLineWidth(0.5);
    doc.line(14, 46, 196, 46);
    let nextY = 52;
    if (harvestDataList.length > 0) {
      autoTable(doc, {
        startY: nextY,
        head: [['Date', 'Plant Variety', 'Raw (kg)', 'Dry (kg)', 'Premium (%)', 'Fine (%)', 'Commercial (%)']],
        body: harvestDataList.map(h => [
          h.harvest_date ? new Date(h.harvest_date).toLocaleDateString() : '',
          (plantDataList.find(p => p.plant_id === h.plant_id)?.coffee_variety) || '-',
          h.coffee_raw_quantity ?? '-',
          h.coffee_dry_quantity ?? '-',
          h.coffee_premium_grade ?? '-',
          h.coffee_fine_grade ?? '-',
          h.coffee_commercial_grade ?? '-',
        ]),
        theme: 'grid',
        headStyles: { fillColor: [34, 197, 94] },
        styles: { fontSize: 11 },
      });
    } else {
      doc.setFontSize(11);
      doc.text('No harvest records found.', 14, nextY + 6);
    }
    // Save the PDF with farmer name in filename
    const safeName = farmerName.replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(`Harvest_Report_${safeName}.pdf`);
    
    // Log PDF export activity
    if (user && farmerDetails) {
      await supabase.from("activity_log").insert({
        user_id: user.id,
        farmer_id: farmerDetails.id,
        entity_type: "harvest_report",
        entity_id: null,
        action: "export",
        change_summary: `Exported harvest report PDF (${harvestDataList.length} records)`,
        old_data: null,
        new_data: JSON.stringify({
          record_count: harvestDataList.length,
          filename: `Harvest_Report_${safeName}.pdf`
        })
      });
    }
  };

  const handleExportWithPreview = async (download = false) => {
    const doc = new jsPDF();
    pdfDocRef.current = doc;
    // Title
    doc.setFontSize(18);
    doc.text('Harvest Report', 14, 18);
    // Date
    doc.setFontSize(10);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 26);
    // Farmer Name
    doc.setFontSize(12);
    let farmerName = user?.fullName || (user?.first_name ? `${user.first_name} ${user.last_name || ''}` : '');
    if (!farmerName && farmerDetails?.first_name) {
      farmerName = `${farmerDetails.first_name} ${farmerDetails.last_name || ''}`;
    }
    farmerName = farmerName.trim() || '-';
    doc.text(`Farmer: ${farmerName}`, 14, 34);
    // Table Section
    doc.setFontSize(14);
    doc.text('Harvest Records', 14, 44);
    doc.setLineWidth(0.5);
    doc.line(14, 46, 196, 46);
    let nextY = 52;
    if (harvestDataList.length > 0) {
      autoTable(doc, {
        startY: nextY,
        head: [['Date', 'Plant Variety', 'Raw (kg)', 'Dry (kg)', 'Premium (%)', 'Fine (%)', 'Commercial (%)']],
        body: harvestDataList.map(h => [
          h.harvest_date ? new Date(h.harvest_date).toLocaleDateString() : '',
          (plantDataList.find(p => p.plant_id === h.plant_id)?.coffee_variety) || '-',
          h.coffee_raw_quantity ?? '-',
          h.coffee_dry_quantity ?? '-',
          h.coffee_premium_grade ?? '-',
          h.coffee_fine_grade ?? '-',
          h.coffee_commercial_grade ?? '-',
        ]),
        theme: 'grid',
        headStyles: { fillColor: [34, 197, 94] },
        styles: { fontSize: 11 },
      });
    } else {
      doc.setFontSize(11);
      doc.text('No harvest records found.', 14, nextY + 6);
    }
    // Show preview or download
    if (download) {
        const farmerName = (user?.fullName || (user?.first_name ? `${user.first_name} ${user.last_name || ''}` : '')).replace(/[^a-zA-Z0-9]/g, '_');
        doc.save(`Harvest_Report_${farmerName}.pdf`);
        
        // Log PDF download activity
        if (user && farmerDetails) {
          await supabase.from("activity_log").insert({
            user_id: user.id,
            farmer_id: farmerDetails.id,
            entity_type: "harvest_report",
            entity_id: null,
            action: "download",
            change_summary: `Downloaded harvest report PDF (${harvestDataList.length} records)`,
            old_data: null,
            new_data: JSON.stringify({
              record_count: harvestDataList.length,
              filename: `Harvest_Report_${farmerName}.pdf`
            })
          });
        }
    } else {
        const blob = doc.output('blob');
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
        setIsPdfPreviewOpen(true);
        
        // Log PDF preview activity
        if (user && farmerDetails) {
          await supabase.from("activity_log").insert({
            user_id: user.id,
            farmer_id: farmerDetails.id,
            entity_type: "harvest_report",
            entity_id: null,
            action: "preview",
            change_summary: `Previewed harvest report PDF (${harvestDataList.length} records)`,
            old_data: null,
            new_data: JSON.stringify({
              record_count: harvestDataList.length
            })
          });
        }
    }
  };

  const adminLinks = [
    { name: "Dashboard", path: "/dashboard" },
    { name: "User Management", path: "/user-management" },
    { name: "Predictive Analytics", path: "/predictive-analytics" },
    { name: "Data Entry", path: "/data-entry" },
    { name: "DSS Recommendations", path: "/dss-recommendations" },
    { name: "Coffee Grade Predictor", path: "/coffee-grader" },
    { name: "Land & Plant Declaration", path: "/land-declaration" },
  ];

  const userLinks = [
    { name: "Dashboard", path: "/farmer-dashboard" },
    { name: "User Profile", path: "/user-profile" },
    { name: "Predictive Analytics", path: "/predictive-analytics" },
    { name: "DSS Recommendations", path: "/dss-recommendations" },
    { name: "Coffee Grade Predictor", path: "/coffee-grader" },
    { name: "Land & Plant Declaration", path: "/land-declaration" },
    { name: "Harvest Reporting", path: "/harvest-reporting" },
  ];

  const navLinks = user?.role === "admin" ? adminLinks : userLinks;

  // Add helper function to validate grade input
  const validateGradeInput = (value, name) => {
    const premiumGrade = parseFloat(name === 'coffee_premium_grade' ? value : harvestInputForm.coffee_premium_grade) || 0;
    const fineGrade = parseFloat(name === 'coffee_fine_grade' ? value : harvestInputForm.coffee_fine_grade) || 0;
    const commercialGrade = parseFloat(name === 'coffee_commercial_grade' ? value : harvestInputForm.coffee_commercial_grade) || 0;
    
    return (premiumGrade + fineGrade + commercialGrade) <= maxDryQuantity;
  };

  // Add function to get unique years from harvest data
  const getUniqueYears = () => {
    const years = harvestDataList.map(harvest => 
      new Date(harvest.harvest_date).getFullYear().toString()
    );
    return ['All', ...Array.from(new Set(years)).sort((a, b) => b - a)];
  };

  // Add function to get unique clusters from plant data
  const getUniqueClusters = () => {
    const clusters = plantDataList.map((plant, index) => index + 1);
    return ['All', ...clusters];
  };

  // Add function to filter harvests by year and cluster
  const getFilteredHarvests = () => {
    let filtered = harvestDataList;
    
    // Filter by year
    if (selectedYear !== 'All') {
      filtered = filtered.filter(harvest => new Date(harvest.harvest_date).getFullYear().toString() === selectedYear);
    }
    
    // Filter by cluster
    if (selectedCluster !== 'All') {
      const clusterNumber = parseInt(selectedCluster);
      filtered = filtered.filter(harvest => {
        const plantIndex = plantDataList.findIndex(p => p.plant_id === harvest.plant_id);
        return plantIndex + 1 === clusterNumber;
      });
    }
    
    // Sort by date
    filtered = filtered.slice().sort((a, b) => {
      const dateA = new Date(a.harvest_date);
      const dateB = new Date(b.harvest_date);
      return yearSortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });
    
    return filtered;
  };





  // Memoize the modal content to prevent unnecessary re-renders
  const memoizedModalContent = useMemo(() => {
    if (!isSampleModalOpen || !modalHarvestId) return null;

    return (
      <div className="flex flex-col gap-6">

        {/* Coffee Sample Grading Form in the middle */}
        <div className="w-full">
          <CoffeeSampleForm
            key={`coffee-form-${modalHarvestId}-${modalEditingSample?.sample_id || 'new'}`}
            harvestId={modalHarvestId}
            plantElevation={harvestDataList.find(h => h.harvest_id === modalHarvestId)?.plant_data?.elevation}
            isDarkMode={isDarkMode}
            onSampleAdded={handleSampleAdded}
            editSample={modalEditingSample}
            onEditDone={handleEditDone}
            compact
            user={user}
            farmerDetails={farmerDetails}
            onResultChange={handleSampleResultChange}
          />
          </div>

        {/* Samples for this Harvest at the bottom */}
        <div className="w-full">
          <SampleList
            key={`sample-list-${modalHarvestId}-${sampleUpdateCounter}`}
            harvestId={modalHarvestId}
            isDarkMode={isDarkMode}
            onSamplesChanged={handleSamplesChanged}
            onTotalsCalculated={handleTotalsCalculated}
            onEditSample={handleEditSample}
            modalEditingSample={modalEditingSample}
            user={user}
            farmerDetails={farmerDetails}
          />
          </div>
          </div>
    );
  }, [modalHarvestId, isDarkMode, handleSamplesChanged, handleTotalsCalculated, handleEditSample, harvestDataList, handleSampleAdded, modalEditingSample, handleEditDone, gradeTotals, isSampleModalOpen, sampleUpdateCounter]);

  // Function to verify calculation accuracy
  const verifyCalculationAccuracy = useCallback(async (harvestId) => {
    if (!harvestId) return;
    
    try {
      // Fetch current harvest data
      const { data: harvestData, error: harvestError } = await supabase
        .from('harvest_data')
        .select('coffee_premium_grade, coffee_fine_grade, coffee_commercial_grade, coffee_dry_quantity')
        .eq('harvest_id', harvestId)
        .single();
      
      if (harvestError) {
        console.error('Error fetching harvest data for verification:', harvestError);
        return;
      }

      // Fetch all samples for this harvest
      const { data: samples, error: samplesError } = await supabase
          .from('coffee_samples')
        .select('bag_weight, predicted_quality_grade')
          .eq('harvest_id', harvestId);
      
      if (samplesError) {
        console.error('Error fetching samples for verification:', samplesError);
        return;
      }

      // Calculate totals from samples
      const calculatedTotals = { premium: 0, fine: 0, commercial: 0 };
      samples?.forEach(sample => {
        const bagWeight = Number(sample.bag_weight) || 0;
        // More comprehensive grade matching - handle all possible formats including JSON strings
        let grade = sample.predicted_quality_grade?.toString().toLowerCase().trim();
        console.log(`Processing grade: "${grade}" for sample ${sample.sample_id}`);
        
        // Handle JSON string format like ["B"] or ["C"]
        if (grade.startsWith('[') && grade.endsWith(']')) {
          try {
            const parsedGrade = JSON.parse(grade);
            grade = Array.isArray(parsedGrade) ? parsedGrade[0]?.toString().toLowerCase() : parsedGrade?.toString().toLowerCase();
            console.log(`Parsed JSON grade: "${grade}"`);
          } catch (e) {
            console.log(`Failed to parse JSON grade: "${grade}"`);
          }
        }
        
        // Based on R API, the model likely returns: "A", "B", "C" or similar
        if (grade === 'b' || grade === 'premium' || grade === 'premium grade' || grade === 'premium grade b' || grade === 'grade b') {
          calculatedTotals.premium += bagWeight;
          console.log(`Added ${bagWeight} to premium (total: ${calculatedTotals.premium})`);
        } else if (grade === 'a' || grade === 'fine' || grade === 'fine grade' || grade === 'fine grade a' || grade === 'grade a') {
          calculatedTotals.fine += bagWeight;
          console.log(`Added ${bagWeight} to fine (total: ${calculatedTotals.fine})`);
        } else if (grade === 'c' || grade === 'commercial' || grade === 'commercial grade' || grade === 'commercial grade c' || grade === 'grade c') {
          calculatedTotals.commercial += bagWeight;
          console.log(`Added ${bagWeight} to commercial (total: ${calculatedTotals.commercial})`);
        } else {
          console.log(`Unknown grade: "${sample.predicted_quality_grade}" for sample ${sample.sample_id}`);
          // Add to commercial as fallback
          calculatedTotals.commercial += bagWeight;
          console.log(`Added ${bagWeight} to commercial as fallback (total: ${calculatedTotals.commercial})`);
        }
      });

      const calculatedTotalDry = calculatedTotals.premium + calculatedTotals.fine + calculatedTotals.commercial;

      // Compare with database values
      const databaseTotals = {
        premium: Number(harvestData.coffee_premium_grade) || 0,
        fine: Number(harvestData.coffee_fine_grade) || 0,
        commercial: Number(harvestData.coffee_commercial_grade) || 0,
        totalDry: Number(harvestData.coffee_dry_quantity) || 0
      };

      console.log('Calculation Verification:', {
        harvestId,
        calculatedTotals,
        calculatedTotalDry,
        databaseTotals,
        isAccurate: Math.abs(calculatedTotalDry - databaseTotals.totalDry) < 0.01
      });

      // If there's a discrepancy, update the database
      if (Math.abs(calculatedTotalDry - databaseTotals.totalDry) >= 0.01) {
        console.log('Discrepancy detected, updating database...');
        await handleTotalsCalculated(calculatedTotals);
      }
    } catch (err) {
      console.error('Error in calculation verification:', err);
    }
  }, [handleTotalsCalculated]);

  // Effect to refresh grade totals when modal opens or samples change
  useEffect(() => {
    if (isSampleModalOpen && modalHarvestId) {
      // Refresh grade totals when modal opens
      initializeGradeTotals(modalHarvestId);
      // Verify calculation accuracy
      verifyCalculationAccuracy(modalHarvestId);
    }
  }, [isSampleModalOpen, modalHarvestId, sampleUpdateCounter, initializeGradeTotals, verifyCalculationAccuracy]);

  return (
    <Layout>
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className={`mb-8 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <button
                  onClick={() => navigate('/farmer-dashboard')}
                  className={`mr-4 px-3 py-1 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500
                    ${isDarkMode ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
                  aria-label="Back to Farmer Dashboard"
                >
                  &larr; Back
                </button>
                <h2 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Harvest Reporting</h2>
              </div>
              <button
                onClick={() => handleExportWithPreview(false)}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors duration-200"
              >
                Export to PDF
              </button>
            </div>
            <p className={`mt-2 text-lg ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              Record and manage your coffee harvest data
            </p>
          </div>

          {/* Harvest Form Section */}
          <div className={`mb-8 p-6 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} hover:shadow-xl transition-shadow duration-200`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className={`text-xl font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Record New Harvest</h3>
              <div className={`p-3 rounded-full ${isDarkMode ? 'bg-green-900' : 'bg-green-100'}`}>
                <svg className={`w-6 h-6 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
            </div>

            <form onSubmit={saveHarvestData} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="plant_id" className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Plant
                  </label>
                  <select
                    id="plant_id"
                    name="plant_id"
                    value={harvestInputForm.plant_id}
                    onChange={handleHarvestInputChange}
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white focus:border-green-500'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-green-500'
                    } focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition-colors`}
                    required
                  >
                    <option value="">Select a plant</option>
                    {plantDataList.map((plant, index) => (
                      <option key={plant.plant_id} value={plant.plant_id}>
                        Cluster {index + 1}: {plant.coffee_variety} (Planted: {new Date(plant.planting_date).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="harvest_date" className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Harvest Date
                  </label>
                  <input
                    id="harvest_date"
                    type="date"
                    name="harvest_date"
                    value={harvestInputForm.harvest_date}
                    onChange={handleHarvestInputChange}
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white focus:border-green-500 date-input-dark'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-green-500 date-input-light'
                    } focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition-colors`}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="coffee_raw_quantity" className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Raw Coffee Quantity (kg)
                  </label>
                  <input
                    id="coffee_raw_quantity"
                    type="number"
                    step="0.01"
                    name="coffee_raw_quantity"
                    value={harvestInputForm.coffee_raw_quantity}
                    onChange={handleHarvestInputChange}
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white focus:border-green-500'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-green-500'
                    } focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition-colors`}
                    required
                  />
                  {harvestInputForm.coffee_raw_quantity > 0 && (
                    <p className={`mt-1 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Max dry: {maxDryQuantity}kg
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowHarvestForm(false);
                    setIsEditingHarvest(false);
                    setHarvestInputForm({
                      harvest_id: null,
                      farmer_id: farmerDetails?.id,
                      plant_id: "",
                      harvest_date: "",
                      coffee_raw_quantity: "",
                      coffee_dry_quantity: "",
                      coffee_premium_grade: "",
                      coffee_fine_grade: "",
                      coffee_commercial_grade: "",
                    });
                  }}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isDarkMode
                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isDarkMode
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  {isEditingHarvest ? 'Update Harvest' : 'Record Harvest'}
                </button>
              </div>
            </form>
          </div>

          {/* Edit Modal */}
          {isModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className={`relative w-full max-w-3xl p-8 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                <button
                  onClick={closeModal}
                  className={`absolute top-4 right-4 text-2xl ${isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-700'}`}
                >
                  ×
                </button>
                
                <h3 className={`text-2xl font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Edit Harvest Record
                </h3>

                <form onSubmit={saveHarvestData} className="space-y-6">
                  {/* Plant and Date Selection */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label htmlFor="edit_plant_id" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Plant
                      </label>
                      <select
                        id="edit_plant_id"
                        name="plant_id"
                        value={harvestInputForm.plant_id}
                        onChange={handleHarvestInputChange}
                        className={`w-full px-4 py-2.5 rounded-lg border ${
                          isDarkMode
                            ? 'bg-gray-700 border-gray-600 text-white focus:border-green-500'
                            : 'bg-white border-gray-300 text-gray-900 focus:border-green-500'
                        } focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition-colors`}
                        required
                      >
                        <option value="">Select a plant</option>
                        {plantDataList.map((plant, index) => (
                          <option key={plant.plant_id} value={plant.plant_id}>
                            Cluster {index + 1}: {plant.coffee_variety} (Planted: {new Date(plant.planting_date).toLocaleDateString()})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="edit_harvest_date" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Harvest Date
                      </label>
                      <input
                        id="edit_harvest_date"
                        type="date"
                        name="harvest_date"
                        value={harvestInputForm.harvest_date}
                        onChange={handleHarvestInputChange}
                        className={`w-full px-4 py-2.5 rounded-lg border ${
                          isDarkMode
                            ? 'bg-gray-700 border-gray-600 text-white focus:border-green-500 date-input-dark'
                            : 'bg-white border-gray-300 text-gray-900 focus:border-green-500 date-input-light'
                        } focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition-colors`}
                        required
                      />
                    </div>
                  </div>

                  {/* Raw and Dry Quantity */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label htmlFor="edit_coffee_raw_quantity" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Raw Coffee Quantity (kg)
                      </label>
                      <input
                        id="edit_coffee_raw_quantity"
                        type="number"
                        step="0.01"
                        name="coffee_raw_quantity"
                        value={harvestInputForm.coffee_raw_quantity}
                        onChange={handleHarvestInputChange}
                        className={`w-full px-4 py-2.5 rounded-lg border ${
                          isDarkMode
                            ? 'bg-gray-700 border-gray-600 text-white focus:border-green-500'
                            : 'bg-white border-gray-300 text-gray-900 focus:border-green-500'
                        } focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition-colors`}
                        required
                      />
                      {harvestInputForm.coffee_raw_quantity > 0 && (
                        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          Maximum dry quantity: {maxDryQuantity}kg (of raw quantity)
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="edit_coffee_dry_quantity" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Total Dry Coffee Quantity (kg)
                      </label>
                      <input
                        id="edit_coffee_dry_quantity"
                        type="number"
                        step="0.01"
                        name="coffee_dry_quantity"
                        value={harvestInputForm.coffee_dry_quantity}
                        readOnly
                        className={`w-full px-4 py-2.5 rounded-lg border ${
                          isDarkMode
                            ? 'bg-gray-600 border-gray-600 text-white'
                            : 'bg-gray-100 border-gray-300 text-gray-900'
                        } cursor-not-allowed`}
                      />
                      <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Auto-calculated from grades
                      </p>
                    </div>
                  </div>



                  <div className="flex justify-end space-x-4 pt-4">
                    <button
                      type="button"
                      onClick={closeModal}
                      className={`px-6 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                        isDarkMode
                          ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                          : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                      }`}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className={`px-6 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                        isDarkMode
                          ? 'bg-green-600 hover:bg-green-700 text-white'
                          : 'bg-green-600 hover:bg-green-700 text-white'
                      }`}
                    >
                      Update Harvest
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Harvest History Section */}
          <div className={`p-6 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} hover:shadow-xl transition-shadow duration-200`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className={`text-xl font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Harvest History</h3>
              <div className="flex items-center space-x-4">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className={`px-3 py-2 rounded-lg border ${
                    isDarkMode
                      ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500'
                      : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                  } focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-colors`}
                >
                  {getUniqueYears().map(year => (
                    <option key={year} value={year}>
                      {year === 'All' ? 'All Years' : year}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedCluster}
                  onChange={(e) => setSelectedCluster(e.target.value)}
                  className={`px-3 py-2 rounded-lg border ${
                    isDarkMode
                      ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500'
                      : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                  } focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-colors`}
                >
                  {getUniqueClusters().map(cluster => (
                    <option key={cluster} value={cluster}>
                      {cluster === 'All' ? 'All Clusters' : `Cluster ${cluster}`}
                    </option>
                  ))}
                </select>
                <select
                  value={yearSortOrder}
                  onChange={e => setYearSortOrder(e.target.value)}
                  className={`px-3 py-2 rounded-lg border ${
                    isDarkMode
                      ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500'
                      : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                  } focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-colors`}
                >
                  <option value="desc">Newest to Oldest</option>
                  <option value="asc">Oldest to Newest</option>
                </select>
                <div className={`p-3 rounded-full ${isDarkMode ? 'bg-blue-900' : 'bg-blue-100'}`}>
                  <svg className={`w-6 h-6 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Tabular Harvest History */}
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200 shadow-sm">Date</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200 shadow-sm">Cluster ID</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200 shadow-sm">Variety</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200 shadow-sm">Elevation (m)</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200 shadow-sm">Raw (kg)</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200 shadow-sm">Dry (kg)</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200 shadow-sm">Fine</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200 shadow-sm">Premium</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200 shadow-sm">Commercial</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200 shadow-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {getFilteredHarvests().length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center py-6 text-gray-500 dark:text-gray-300">No harvest records found.</td>
                    </tr>
                  ) : (
                    getFilteredHarvests().map((harvest, index) => {
                      const plant = plantDataList.find(p => p.plant_id === harvest.plant_id);
                      const clusterIndex = plantDataList.findIndex(p => p.plant_id === harvest.plant_id) + 1;
                      return (
                        <tr key={harvest.harvest_id} className={
                          (currentHarvestId === harvest.harvest_id ? (isDarkMode ? 'bg-green-900' : 'bg-green-100') : (isDarkMode ? 'bg-gray-700' : 'bg-white'))
                        }>
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{new Date(harvest.harvest_date).toLocaleDateString()}</td>
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                              isDarkMode ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-800'
                            }`}>
                              {clusterIndex}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{plant ? plant.coffee_variety : 'Unknown'}</td>
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{harvest.plant_data?.elevation || plant?.elevation || '-'}</td>
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{harvest.coffee_raw_quantity}</td>
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{harvest.coffee_dry_quantity}</td>
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{harvest.coffee_fine_grade}</td>
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{harvest.coffee_premium_grade}</td>
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{harvest.coffee_commercial_grade}</td>
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                            <div className="flex space-x-2">
                              <button
                                onClick={async () => {
                                  setModalHarvestId(harvest.harvest_id);
                                  setIsSampleModalOpen(true);
                                  setModalEditingSample(null);
                                  // Initialize grade totals when modal opens
                                  await initializeGradeTotals(harvest.harvest_id);
                                  
                                  // Log opening sample grading modal
                                  if (user && farmerDetails) {
                                    await supabase.from("activity_log").insert({
                                      user_id: user.id,
                                      farmer_id: farmerDetails.id,
                                      entity_type: "sample_grading",
                                      entity_id: harvest.harvest_id,
                                      action: "open_modal",
                                      change_summary: `Opened sample grading for harvest (${harvest.harvest_date})`,
                                      old_data: null,
                                      new_data: JSON.stringify({
                                        harvest_id: harvest.harvest_id,
                                        harvest_date: harvest.harvest_date,
                                        plant_variety: plantDataList.find(p => p.plant_id === harvest.plant_id)?.coffee_variety
                                      })
                                    });
                                  }
                                }}
                                className={`p-2 rounded-lg transition-colors ${
                                  isSampleModalOpen && modalHarvestId === harvest.harvest_id
                                    ? (isDarkMode ? 'bg-green-700 text-white' : 'bg-green-600 text-white')
                                    : (isDarkMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-100 hover:bg-blue-200 text-blue-700')
                                }`}
                              >
                                {isSampleModalOpen && modalHarvestId === harvest.harvest_id ? 'Grading Coffee Bags' : 'Grade'}
                              </button>
                              <button
                                onClick={() => editHarvest(harvest)}
                                className={`p-2 rounded-lg transition-colors ${
                                  isDarkMode
                                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                    : 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                                }`}
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => deleteHarvest(harvest.harvest_id)}
                                className={`p-2 rounded-lg transition-colors ${
                                  isDarkMode
                                    ? 'bg-red-600 hover:bg-red-700 text-white'
                                    : 'bg-red-100 hover:bg-red-200 text-red-700'
                                }`}
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
                  </div>
                    </div>
        </div>
      </div>
      {isSampleModalOpen && (
        <div key={`modal-${modalHarvestId}`} className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div key={`modal-content-${modalHarvestId}`} className={`relative w-full max-w-7xl h-[90vh] rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} flex flex-col`}>
                        {/* Compact Harvest Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-600">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-4">
                  <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Manage Coffee Samples</h3>
                  {sampleResult && (
                    <div className={`flex items-center space-x-2 px-3 py-1 rounded-lg border-2 border-green-300 dark:border-green-600 ${isDarkMode ? 'bg-green-900/20' : 'bg-green-50'}`}>
                      <svg className="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className={`text-sm font-medium ${isDarkMode ? 'text-green-300' : 'text-green-700'}`}>
                        Grade: {(() => {
                          let grade = sampleResult;
                          
                          // Handle JSON array format like ["A"], ["B"], ["C"]
                          if (typeof grade === 'string' && grade.startsWith('[') && grade.endsWith(']')) {
                            try {
                              const parsedGrade = JSON.parse(grade);
                              grade = Array.isArray(parsedGrade) ? parsedGrade[0] : parsedGrade;
                            } catch (e) {
                              console.log(`Failed to parse JSON grade: "${grade}"`);
                            }
                          }
                          
                          // Convert to string and normalize
                          grade = grade?.toString().toUpperCase();
                          
                          if (grade === 'A' || grade === 'FINE') return 'Fine';
                          if (grade === 'B' || grade === 'PREMIUM') return 'Premium';
                          if (grade === 'C' || grade === 'COMMERCIAL') return 'Commercial';
                          return grade || 'Unknown';
                        })()}
                      </span>
                    </div>
                  )}
                </div>
            <button
              onClick={() => setIsSampleModalOpen(false)}
                  className={`text-xl ${isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-700'}`}
            >
              ×
            </button>
              </div>
              {(() => {
                const harvest = harvestDataList.find(h => h.harvest_id === modalHarvestId);
                const plant = plantDataList.find(p => p.plant_id === harvest?.plant_id);
                return harvest ? (
                  <div className="space-y-3">
                    {/* Combined Header and Grade Totals in Single Row */}
                    <div className="grid grid-cols-9 gap-3 text-xs">
                      {/* Basic Harvest Info - 6 columns */}
                      <div className={`p-2 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                        <div className={`font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Date</div>
                        <div className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {harvest.harvest_date ? new Date(harvest.harvest_date).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric',
                            year: 'numeric'
                          }) : '-'}
                  </div>
            </div>
                      <div className={`p-2 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                        <div className={`font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Cluster ID</div>
                        <div className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${
                            isDarkMode ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-800'
                          }`}>
                            {plantDataList.findIndex(p => p.plant_id === harvest.plant_id) + 1}
                          </span>
                        </div>
                      </div>
                      <div className={`p-2 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                        <div className={`font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Variety</div>
                        <div className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {plant ? plant.coffee_variety : 'Unknown'}
              </div>
                    </div>
                      <div className={`p-2 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                        <div className={`font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Elevation</div>
                        <div className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {harvest.plant_data?.elevation || plant?.elevation || '-'} m
              </div>
                    </div>
                      <div className={`p-2 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                        <div className={`font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Raw</div>
                        <div className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {harvest.coffee_raw_quantity ? `${harvest.coffee_raw_quantity} kg` : '-'}
                    </div>
                    </div>
                      <div className={`p-2 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                        <div className={`font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Dry</div>
                        <div className={`font-semibold ${isDarkMode ? 'text-indigo-300' : 'text-indigo-700'}`}>
                          {(gradeTotals.premium + gradeTotals.fine + gradeTotals.commercial).toFixed(2)} kg
                    </div>
                  </div>
                      
                      {/* Grade Totals - 3 columns */}
                      <div className={`p-2 rounded ${isDarkMode ? 'bg-blue-900/50' : 'bg-blue-50'}`}>
                        <div className={`font-medium ${isDarkMode ? 'text-blue-200' : 'text-blue-700'}`}>Fine</div>
                        <div className={`font-bold ${isDarkMode ? 'text-blue-300' : 'text-blue-700'}`}>
                          {gradeTotals.fine.toFixed(2)} kg
                        </div>
                        <div className={`text-xs ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                          {gradeTotals.premium + gradeTotals.fine + gradeTotals.commercial > 0 
                            ? `${((gradeTotals.fine / (gradeTotals.premium + gradeTotals.fine + gradeTotals.commercial)) * 100).toFixed(1)}%`
                            : '0%'
                          }
                        </div>
                      </div>
                      <div className={`p-2 rounded ${isDarkMode ? 'bg-green-900/50' : 'bg-green-50'}`}>
                        <div className={`font-medium ${isDarkMode ? 'text-green-200' : 'text-green-700'}`}>Premium</div>
                        <div className={`font-bold ${isDarkMode ? 'text-green-300' : 'text-green-700'}`}>
                          {gradeTotals.premium.toFixed(2)} kg
                </div>
                        <div className={`text-xs ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                          {gradeTotals.premium + gradeTotals.fine + gradeTotals.commercial > 0 
                            ? `${((gradeTotals.premium / (gradeTotals.premium + gradeTotals.fine + gradeTotals.commercial)) * 100).toFixed(1)}%`
                            : '0%'
                          }
              </div>
            </div>
                      <div className={`p-2 rounded ${isDarkMode ? 'bg-yellow-900/50' : 'bg-yellow-50'}`}>
                        <div className={`font-medium ${isDarkMode ? 'text-yellow-200' : 'text-yellow-700'}`}>Commercial</div>
                        <div className={`font-bold ${isDarkMode ? 'text-yellow-300' : 'text-yellow-700'}`}>
                          {gradeTotals.commercial.toFixed(2)} kg
                        </div>
                        <div className={`text-xs ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                          {gradeTotals.premium + gradeTotals.fine + gradeTotals.commercial > 0 
                            ? `${((gradeTotals.commercial / (gradeTotals.premium + gradeTotals.fine + gradeTotals.commercial)) * 100).toFixed(1)}%`
                            : '0%'
                          }
                        </div>
                      </div>
                    </div>
                    
                    {/* Live Updates Indicator */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          Grade Totals (Auto-calculated from samples)
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Farm Elevation: {farmerDetails?.farm_elevation ? `${farmerDetails.farm_elevation}m` : 'Not set'}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full bg-green-500 animate-pulse`}></div>
                        <span className={`text-xs ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>Live Updates</span>
                        <button
                          onClick={() => {
                            console.log('Manual recalculation triggered');
                            initializeGradeTotals(modalHarvestId);
                          }}
                          className={`px-2 py-1 text-xs rounded ${isDarkMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-100 hover:bg-blue-200 text-blue-700'}`}
                        >
                          Recalculate
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null;
              })()}
            </div>
            {/* Scrollable content area */}
            <div className="flex-1 overflow-y-auto p-6">
              {memoizedModalContent}
            </div>
          </div>
        </div>
      )}

      {/* PDF Preview Modal */}
        {isPdfPreviewOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-3xl w-full p-6 relative flex flex-col`} style={{height: '80vh'}}>
                    <button
                        className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                        onClick={() => {
                            setIsPdfPreviewOpen(false);
                            if (pdfUrl) URL.revokeObjectURL(pdfUrl);
                            setPdfUrl(null);
                        }}
                        aria-label="Close"
                    >
                        &times;
                    </button>
                    <h2 className={`text-xl font-bold mb-4 text-center ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>PDF Preview</h2>
                    {pdfUrl && (
                        <iframe
                            id="pdf-preview-iframe"
                            src={pdfUrl}
                            title="PDF Preview"
                            className="w-full flex-1 border rounded"
                            style={{ minHeight: '60vh', background: '#fff' }}
                        />
                    )}
                    <div className="flex justify-end mt-4 gap-2">
                        <button
                            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors duration-200"
                            onClick={() => handleExportWithPreview(true)}
                        >
                            Download PDF
                        </button>
                    </div>
                </div>
            </div>
        )}
    </Layout>
  );
};

export default HarvestReporting;