import React from 'react';
import { Lightbulb, TrendingUp, TrendingDown, Target } from 'lucide-react';

const AdminDSS = ({ recommendations, isDarkMode }) => {
  const getIcon = (type) => {
    switch (type) {
      case 'Opportunity':
        return <TrendingUp className="w-6 h-6 text-green-500" />;
      case 'Warning':
        return <TrendingDown className="w-6 h-6 text-yellow-500" />;
      case 'Action':
        return <Target className="w-6 h-6 text-blue-500" />;
      default:
        return <Lightbulb className="w-6 h-6 text-gray-500" />;
    }
  };

  if (!recommendations || recommendations.length === 0) {
    return (
      <div className={`p-6 rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <h3 className={`text-lg font-medium mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          Decision Support System
        </h3>
        <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
          No specific recommendations at this time. All systems are performing within expected parameters.
        </p>
      </div>
    );
  }

  return (
    <div className={`p-6 rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
      <h3 className={`text-lg font-medium mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
        Decision Support System
      </h3>
      <div className="space-y-4">
        {recommendations.map((rec, index) => (
          <div key={index} className={`p-4 rounded-lg flex items-start space-x-4 ${
            isDarkMode ? 'bg-gray-700' : 'bg-gray-50'
          }`}>
            <div className="flex-shrink-0">
              {getIcon(rec.type)}
            </div>
            <div>
              <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                {rec.title}
              </p>
              <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                {rec.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminDSS; 