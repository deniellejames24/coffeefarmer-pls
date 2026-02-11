import React from 'react';
import { useTheme } from '../lib/ThemeContext';

const VerificationStatus = ({ status, adminNotes, submittedAt, verifiedAt, verifiedBy }) => {
  const { isDarkMode } = useTheme();

  const getStatusConfig = (status) => {
    const configs = {
      draft: {
        color: 'bg-gray-500',
        text: 'Draft',
        icon: '📝',
        description: 'Data is saved as draft and not submitted for review'
      },
      pending: {
        color: 'bg-yellow-500',
        text: 'Pending Review',
        icon: '⏳',
        description: 'Data submitted and waiting for admin review'
      },
      approved: {
        color: 'bg-green-500',
        text: 'Approved',
        icon: '✅',
        description: 'Data has been approved by admin'
      },
      rejected: {
        color: 'bg-red-500',
        text: 'Rejected',
        icon: '❌',
        description: 'Data was rejected by admin'
      }
    };
    return configs[status] || configs.draft;
  };

  const config = getStatusConfig(status);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className={`p-4 rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-xl">{config.icon}</span>
          <span className={`px-2 py-1 rounded-full text-xs font-medium text-white ${config.color}`}>
            {config.text}
          </span>
        </div>
        {status === 'approved' && verifiedAt && (
          <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Approved on {formatDate(verifiedAt)}
          </span>
        )}
      </div>

      <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} mb-3`}>
        {config.description}
      </p>

      {submittedAt && (
        <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-2`}>
          <strong>Submitted:</strong> {formatDate(submittedAt)}
        </div>
      )}

      {status === 'rejected' && adminNotes && (
        <div className={`mt-3 p-3 rounded-lg ${isDarkMode ? 'bg-red-900/20 border border-red-800' : 'bg-red-50 border border-red-200'}`}>
          <div className={`text-sm font-medium ${isDarkMode ? 'text-red-300' : 'text-red-800'} mb-1`}>
            Admin Notes:
          </div>
          <div className={`text-sm ${isDarkMode ? 'text-red-200' : 'text-red-700'}`}>
            {adminNotes}
          </div>
        </div>
      )}

      {status === 'approved' && adminNotes && (
        <div className={`mt-3 p-3 rounded-lg ${isDarkMode ? 'bg-green-900/20 border border-green-800' : 'bg-green-50 border border-green-200'}`}>
          <div className={`text-sm font-medium ${isDarkMode ? 'text-green-300' : 'text-green-800'} mb-1`}>
            Admin Notes:
          </div>
          <div className={`text-sm ${isDarkMode ? 'text-green-200' : 'text-green-700'}`}>
            {adminNotes}
          </div>
        </div>
      )}

      {verifiedBy && (status === 'approved' || status === 'rejected') && (
        <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mt-2`}>
          <strong>Reviewed by:</strong> {verifiedBy}
        </div>
      )}
    </div>
  );
};

export default VerificationStatus;
