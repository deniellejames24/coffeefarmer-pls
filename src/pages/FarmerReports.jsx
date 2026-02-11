import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useTheme } from "../lib/ThemeContext";
import Layout from "../components/Layout";
import { useAuth } from "../lib/AuthProvider";
import SearchableDropdown from "../components/SearchableDropdown";

// Import Chart.js components
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const FarmerReports = () => {
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const [farmersReport, setFarmersReport] = useState([]);
  const [filteredFarmers, setFilteredFarmers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [topPerformers, setTopPerformers] = useState([]);
  const [performanceData, setPerformanceData] = useState({
    labels: [],
    datasets: [
      {
        label: 'Total Raw Yield (kg)',
        data: [],
        backgroundColor: 'rgb(75, 192, 192)',
      },
      {
        label: 'Total Trees',
        data: [],
        backgroundColor: 'rgb(54, 162, 235)',
      }
    ]
  });

  // Filter States
  const [searchName, setSearchName] = useState("");
  const [searchLocation, setSearchLocation] = useState("");

  // New states for unique values
  const [uniqueNames, setUniqueNames] = useState([]);
  const [uniqueLocations, setUniqueLocations] = useState([]);

  // Function to fetch all necessary data and combine them
  const fetchFarmerReports = useCallback(async () => {
    try {
    setLoading(true);
    setError(null);

      // First fetch users
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, first_name, last_name');

      if (usersError) throw usersError;

      // Then fetch farmer details
      const { data: farmerDetails, error: farmerError } = await supabase
        .from('farmer_detail')
        .select(`
          farmers_details,
          id,
          farm_location,
          farm_size,
          farm_elevation,
          plant_id
        `);

      if (farmerError) throw farmerError;

      // Fetch plant data
      const { data: plantData, error: plantError } = await supabase
        .from('plant_data')
        .select('plant_id, farmer_id, number_of_tree_planted, elevation, cluster_size');

      if (plantError) throw plantError;

      // Fetch harvest data
      const { data: harvests, error: harvestError } = await supabase
        .from('harvest_data')
        .select('*');

      if (harvestError) throw harvestError;

      // Process and combine the data
      const processedData = farmerDetails.map(farmer => {
        // Get user information
        const user = users.find(u => u.id === farmer.id);

        // Get all plants for this farmer
        const farmerPlants = plantData.filter(p => p.farmer_id === farmer.id);
        const totalTrees = farmerPlants.reduce((sum, plant) => sum + (plant.number_of_tree_planted || 0), 0);

        // Get all harvests for this farmer
        const farmerHarvests = harvests.filter(h => h.farmer_id === farmer.id);
        
        // Calculate total yields
        const totalRawYield = farmerHarvests.reduce((sum, h) => sum + (h.coffee_raw_quantity || 0), 0);
        const totalDryYield = farmerHarvests.reduce((sum, h) => sum + (h.coffee_dry_quantity || 0), 0);
        const premiumGrade = farmerHarvests.reduce((sum, h) => sum + (h.coffee_premium_grade || 0), 0);
        const fineGrade = farmerHarvests.reduce((sum, h) => sum + (h.coffee_fine_grade || 0), 0);
        const commercialGrade = farmerHarvests.reduce((sum, h) => sum + (h.coffee_commercial_grade || 0), 0);

        // Calculate averages
        const avgYieldPerTree = totalTrees > 0 ? totalDryYield / totalTrees : 0;

        // Get the latest harvest date
        const lastHarvestDate = farmerHarvests.length > 0 
          ? new Date(Math.max(...farmerHarvests.map(h => new Date(h.harvest_date))))
          : null;

        return {
          id: farmer.id,
          name: user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'Unnamed Farmer',
          farm_location: farmer.farm_location,
          farm_size: farmer.farm_size,
          farm_elevation: farmer.farm_elevation,
          total_trees: totalTrees,
          totalRawYield,
          totalDryYield,
          avgYieldPerTree,
          premiumGrade,
          fineGrade,
          commercialGrade,
          lastHarvest: lastHarvestDate ? lastHarvestDate.toLocaleDateString() : 'N/A',
          harvestCount: farmerHarvests.length
        };
      });

      // Sort farmers by total yield for the performance chart
      const sortedByYield = [...processedData].sort((a, b) => b.totalDryYield - a.totalDryYield);
      const top5Farmers = sortedByYield.slice(0, 5);

      // Update performance chart data
      setPerformanceData({
        labels: top5Farmers.map(f => f.name),
        datasets: [
          {
            label: 'Total Raw Yield (kg)',
            data: top5Farmers.map(f => f.totalRawYield.toFixed(2)),
            backgroundColor: 'rgb(75, 192, 192)',
          },
          {
            label: 'Total Trees',
            data: top5Farmers.map(f => f.total_trees),
            backgroundColor: 'rgb(54, 162, 235)',
          }
        ]
      });

      // Set top performers
      setTopPerformers(top5Farmers.slice(0, 3));

      // Update the main data states
      setFarmersReport(processedData);
      setFilteredFarmers(processedData);

      // After processing the data, extract unique values
      const names = [...new Set(processedData.map(farmer => farmer.name))];
      const locations = [...new Set(processedData.map(farmer => farmer.farm_location))];
      
      setUniqueNames(names);
      setUniqueLocations(locations);

    } catch (err) {
      console.error('Error fetching farmer reports:', err);
      setError('Failed to load farmer reports. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFarmerReports();
  }, [fetchFarmerReports]);

  // Filter function
  const applyFilters = useCallback(() => {
    let filtered = [...farmersReport];

    if (searchName) {
      filtered = filtered.filter(farmer =>
        farmer.name.toLowerCase().includes(searchName.toLowerCase())
      );
      }

    if (searchLocation) {
      filtered = filtered.filter(farmer =>
        farmer.farm_location.toLowerCase().includes(searchLocation.toLowerCase())
      );
      }

    setFilteredFarmers(filtered);
  }, [farmersReport, searchName, searchLocation]);

  useEffect(() => {
    applyFilters();
  }, [searchName, searchLocation, applyFilters]);

  if (!user) {
    return <Navigate to="/login" />;
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className={`mb-8 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6`}>
          <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Farmer Reports
          </h1>
          {user && (
            <p className={`mt-2 text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-700'}`}>
              Welcome back, {user.first_name} {user.last_name}
            </p>
          )}
          <p className={`mt-2 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-700'}`}>
            Detailed reports and performance metrics for all farmers
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900 border border-red-700 rounded-md text-red-200">
            <p>{error}</p>
          </div>
        )}

        {/* Performance Overview Chart */}
        <div className={`rounded-lg p-6 mb-8 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
          <h2 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Farmer Performance Overview
          </h2>
          <div className="h-80">
            <Bar
              data={performanceData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  y: {
                    beginAtZero: true,
                    grid: {
                      color: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                    },
                    ticks: {
                      color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)'
                    }
                  },
                  x: {
                    grid: {
                      color: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                    },
                    ticks: {
                      color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)'
                    }
                  }
                },
    plugins: {
      legend: {
                    labels: {
                      color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)'
                    }
                  }
                }
              }}
            />
          </div>
        </div>

        {/* Top 3 Best Performing Farmers */}
        <div className={`rounded-lg p-6 mb-8 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
          <h2 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Top 3 Best Performing Farmers
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {topPerformers.map((farmer, index) => (
              <div key={farmer.id} className={`rounded-lg p-4 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center">
                    <span className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>#{index + 1}</span>
                    </div>
                  <div className="bg-yellow-500 text-white rounded-full w-8 h-8 flex items-center justify-center">
                    {index + 1}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{farmer.name}</p>
                  <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Location: {farmer.farm_location}</p>
                  <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Total Raw Yield: {farmer.totalRawYield.toFixed(2)} kg</p>
                  <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Total Trees: {farmer.total_trees}</p>
                  <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Premium Grade: {farmer.premiumGrade.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

        {/* Filter Section */}
        <div className={`rounded-lg p-4 mb-8 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-sm`}> 
          <h2 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Filter Farmers</h2>
          <div className="flex flex-col md:flex-row md:items-end md:space-x-4 space-y-3 md:space-y-0">
            <div className="flex-1 min-w-[180px]">
              <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Farmer Name</label>
              <select
                value={searchName}
                onChange={e => setSearchName(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              >
                <option value="">All</option>
                {uniqueNames.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Location</label>
              <select
                value={searchLocation}
                onChange={e => setSearchLocation(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              >
                <option value="">All</option>
                {uniqueLocations.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-row space-x-2 mt-2 md:mt-0">
              <button
                onClick={() => {
                  setSearchName("");
                  setSearchLocation("");
                }}
                className={`px-3 py-2 rounded-lg flex items-center text-sm transition-colors duration-200
                  ${isDarkMode 
                    ? 'bg-gray-700 text-white hover:bg-gray-600' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
              >
                <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Clear
              </button>
              <button
                onClick={applyFilters}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 text-sm flex items-center transition-colors duration-200"
              >
                <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Apply
              </button>
            </div>
          </div>
        </div>

        {/* Filtered Results */}
        <div className={`rounded-lg overflow-hidden ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
          {loading ? (
            <div className="p-6">
              <div className="animate-pulse space-y-4">
                <div className={`h-4 rounded w-1/4 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className={`h-4 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
                  ))}
                </div>
        </div>
      </div>
          ) : (
            <div className="overflow-x-auto">
              {filteredFarmers.map((farmer) => (
                <div key={farmer.id} className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} p-4`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className={`text-lg font-medium mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {farmer.name}
                      </h3>
                      <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Location: {farmer.farm_location}</p>
                      <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Total Trees: {farmer.total_trees}</p>
                      <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Total Yield: {farmer.totalDryYield.toFixed(2)} kg</p>
          </div>
                    <div className="text-right">
                      <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Average Yield per Tree: {farmer.avgYieldPerTree.toFixed(2)} kg</p>
                      <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Last Harvest: {farmer.lastHarvest}</p>
                      <button
                        onClick={() => navigate(`/farmer-profile/${farmer.id}`)}
                        className={`mt-2 px-4 py-2 rounded-lg text-sm transition-colors
                          ${isDarkMode
                            ? 'bg-blue-600 text-white hover:bg-blue-500'
                            : 'bg-blue-500 text-white hover:bg-blue-600'}`}
                      >
                        View Details
                      </button>
                  </div>
                  </div>
                  </div>
                ))}
              </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default FarmerReports;