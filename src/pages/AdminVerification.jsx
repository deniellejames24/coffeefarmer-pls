import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useTheme } from '../lib/ThemeContext';
import { useAuth } from '../lib/AuthProvider';
import Layout from '../components/Layout';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const AdminVerification = () => {
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  const { user: authUser } = useAuth();
  const [pendingItems, setPendingItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [filterStatus, setFilterStatus] = useState('pending');
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    if (!authUser) {
      navigate('/login');
      return;
    }

    // Check if user is admin
    const checkAdminRole = async () => {
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', authUser.id)
        .single();

      if (userData?.role !== 'admin') {
        toast.error('Access denied. Admin privileges required.');
        navigate('/dashboard');
        return;
      }
    };

    checkAdminRole();
    fetchPendingItems();
  }, [authUser, navigate, filterStatus, filterType]);

  const fetchPendingItems = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('admin_verification_dashboard')
        .select('*')
        .order('submitted_at', { ascending: false });

      if (filterStatus !== 'all') {
        query = query.eq('verification_status', filterStatus);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Filter by type if needed
      let filteredData = data;
      if (filterType !== 'all') {
        filteredData = data.filter(item => item.entity_type === filterType);
      }

      setPendingItems(filteredData);
    } catch (error) {
      console.error('Error fetching pending items:', error);
      toast.error('Failed to load pending verifications');
    } finally {
      setLoading(false);
    }
  };

  const fetchItemDetails = async (item) => {
    try {
      let query;
      let selectFields;

      switch (item.entity_type) {
        case 'farmer_detail':
          selectFields = '*, users(first_name, last_name, email)';
          query = supabase
            .from('farmer_detail')
            .select(selectFields)
            .eq('id', item.entity_id)
            .single();
          break;

        case 'plant_data':
          selectFields = '*, farmer_detail(id, farm_location), users(first_name, last_name, email)';
          query = supabase
            .from('plant_data')
            .select(selectFields)
            .eq('plant_id', item.entity_id)
            .single();
          break;

        case 'plant_status':
          selectFields = '*, plant_data(coffee_variety, farmer_detail(id, farm_location)), users(first_name, last_name, email)';
          query = supabase
            .from('plant_status')
            .select(selectFields)
            .eq('plant_status_id', item.entity_id)
            .single();
          break;

        case 'harvest_data':
          selectFields = '*, plant_data(coffee_variety, farmer_detail(id, farm_location)), users(first_name, last_name, email)';
          query = supabase
            .from('harvest_data')
            .select(selectFields)
            .eq('harvest_id', item.entity_id)
            .single();
          break;

        case 'coffee_samples':
          selectFields = '*, harvest_data(harvest_date, plant_data(coffee_variety, farmer_detail(id, farm_location))), users(first_name, last_name, email)';
          query = supabase
            .from('coffee_samples')
            .select(selectFields)
            .eq('sample_id', item.entity_id)
            .single();
          break;

        default:
          throw new Error('Unknown entity type');
      }

      const { data, error } = await query;
      if (error) throw error;

      setSelectedItem({ ...item, details: data });
      setShowModal(true);
    } catch (error) {
      console.error('Error fetching item details:', error);
      toast.error('Failed to load item details');
    }
  };

  const handleVerification = async (status) => {
    if (!selectedItem) return;

    try {
      const { error } = await supabase.rpc('update_verification_status', {
        p_table_name: selectedItem.entity_type,
        p_entity_id: selectedItem.entity_id.toString(),
        p_status: status,
        p_admin_notes: adminNotes || null,
        p_admin_user_id: authUser.id
      });

      if (error) throw error;

      toast.success(`Item ${status} successfully`);
      setShowModal(false);
      setSelectedItem(null);
      setAdminNotes('');
      fetchPendingItems();
    } catch (error) {
      console.error('Error updating verification status:', error);
      toast.error('Failed to update verification status');
    }
  };

  const getStatusBadge = (status) => {
    const statusColors = {
      draft: 'bg-gray-500',
      pending: 'bg-yellow-500',
      approved: 'bg-green-500',
      rejected: 'bg-red-500'
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium text-white ${statusColors[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getTypeIcon = (type) => {
    const icons = {
      farmer_detail: '🏠',
      plant_data: '🌱',
      plant_status: '📊',
      harvest_data: '☕',
      coffee_samples: '🔬'
    };
    return icons[type] || '📄';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
        <ToastContainer />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Admin Verification Dashboard
            </h1>
            <p className={`mt-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              Review and verify farmer data submissions
            </p>
          </div>

          {/* Filters */}
          <div className={`mb-6 p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
            <div className="flex flex-wrap gap-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Status Filter
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className={`px-3 py-2 rounded-lg border ${
                    isDarkMode
                      ? 'bg-gray-700 border-gray-600 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Type Filter
                </label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className={`px-3 py-2 rounded-lg border ${
                    isDarkMode
                      ? 'bg-gray-700 border-gray-600 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  <option value="all">All Types</option>
                  <option value="farmer_detail">Farm Details</option>
                  <option value="plant_data">Plant Clusters</option>
                  <option value="plant_status">Plant Status</option>
                  <option value="harvest_data">Harvest Reports</option>
                  <option value="coffee_samples">Coffee Samples</option>
                </select>
              </div>
            </div>
          </div>

          {/* Pending Items List */}
          <div className={`rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
            {pendingItems.length === 0 ? (
              <div className="p-8 text-center">
                <p className={`text-lg ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  No items pending verification
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <tr>
                      <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                        Type
                      </th>
                      <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                        Status
                      </th>
                      <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                        Submitted
                      </th>
                      <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                    {pendingItems.map((item) => (
                      <tr key={`${item.entity_type}-${item.entity_id}`} className={`hover:${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <span className="text-2xl mr-3">{getTypeIcon(item.entity_type)}</span>
                            <div>
                              <div className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                {item.display_name}
                              </div>
                              <div className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                                ID: {item.entity_id}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(item.verification_status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(item.submitted_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => fetchItemDetails(item)}
                            className={`text-green-600 hover:text-green-900 ${isDarkMode ? 'hover:text-green-400' : ''}`}
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Verification Modal */}
        {showModal && selectedItem && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className={`max-w-4xl w-full max-h-[90vh] overflow-y-auto ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-xl`}>
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Review {selectedItem.display_name}
                  </h2>
                  <button
                    onClick={() => setShowModal(false)}
                    className={`text-gray-400 hover:text-gray-600 ${isDarkMode ? 'hover:text-gray-300' : ''}`}
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Item Details */}
                <div className={`mb-6 p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Submission Details
                  </h3>
                  <pre className={`text-sm overflow-x-auto ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    {JSON.stringify(selectedItem.details, null, 2)}
                  </pre>
                </div>

                {/* Admin Notes */}
                <div className="mb-6">
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Admin Notes (Optional)
                  </label>
                  <textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    rows={3}
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    placeholder="Add notes about this verification..."
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-4">
                  <button
                    onClick={() => setShowModal(false)}
                    className={`px-4 py-2 rounded-lg border ${
                      isDarkMode
                        ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleVerification('rejected')}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleVerification('approved')}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Approve
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AdminVerification;
