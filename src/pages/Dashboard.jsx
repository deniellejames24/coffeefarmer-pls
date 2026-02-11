import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useTheme } from "../lib/ThemeContext";
import { useAuth } from "../lib/AuthProvider";
import Layout from '../components/Layout';

// Import Chart.js components
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Title } from 'chart.js';
import { Pie, Line } from 'react-chartjs-2';
import AdminDSS from '../components/analytics/AdminDSS';

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Title);

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDarkMode, toggleTheme } = useTheme();
  const { user } = useAuth();
  const [totalFarmers, setTotalFarmers] = useState(0);
  const [totalHarvests, setTotalHarvests] = useState(0); // This will now be total quantity
  const [totalPlants, setTotalPlants] = useState(0);     // This will now be total number of trees
  const [recentActivities, setRecentActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activityLogs, setActivityLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState("");
  const [showLogsModal, setShowLogsModal] = useState(false);

  // States for Chart Data
  const [gradeDistributionData, setGradeDistributionData] = useState({
    labels: [],
    datasets: []
  });
  const [seasonalHarvestData, setSeasonalHarvestData] = useState({
    labels: [],
    datasets: []
  });
  const [forecastedHarvestAmount, setForecastedHarvestAmount] = useState(null);
  const [dssRecommendations, setDssRecommendations] = useState([]);
  const [predictiveMetrics, setPredictiveMetrics] = useState({
    expectedYield: 0,
    growthRate: 0,
    performanceCategories: {
      high: { count: 0, farmers: [] },
      average: { count: 0, farmers: [] },
      needsSupport: { count: 0, farmers: [] }
    }
  });

  const [expandedCategories, setExpandedCategories] = useState({
    high: false,
    average: false,
    needsSupport: false
  });

  // Add state for expanded log rows
  const [expandedLogRows, setExpandedLogRows] = useState([]);
  // Add state for filters
  const [entityFilter, setEntityFilter] = useState('All');
  const [actionFilter, setActionFilter] = useState('All');
  const [farmerFilter, setFarmerFilter] = useState('All');


  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user) {
        navigate("/login");
        return;
      }

      // Redirect non-admin users immediately
      if (user.role !== "admin") {
        navigate("/farmer-dashboard", { replace: true });
        return;
      }

      setLoading(true);
      setError("");

      try {
        // Fetch all data in parallel using Promise.all
        const [
          farmersResult,
          harvestResult,
          plantResult,
          recentFarmersResult,
          recentHarvestsResult
        ] = await Promise.all([
          // Total Farmers count - Modified query to ensure we get all farmers
          supabase.from("users")
            .select("id", { count: "exact" })
            .eq("role", "farmer"),
          
          // Harvest data
          supabase.from("harvest_data").select(`
            coffee_raw_quantity,
            coffee_fine_grade,
            coffee_premium_grade,
            coffee_commercial_grade,
            harvest_date
          `),
          
          // Plant data
          supabase.from("plant_data").select("number_of_tree_planted, elevation, cluster_size"),
          
          // Recent farmers
          supabase.from("users")
            .select("id, created_at, first_name, last_name")
            .eq("role", "farmer")
            .order("created_at", { ascending: false }),
          
          // Recent harvests
          supabase.from("harvest_data")
            .select("harvest_date, farmer_id, farmer_detail(users(first_name, last_name))")
            .order("harvest_date", { ascending: false })
        ]);

        // Handle any errors from the parallel requests
        const errors = [
          farmersResult.error,
          harvestResult.error,
          plantResult.error,
          recentFarmersResult.error,
          recentHarvestsResult.error
        ].filter(Boolean);

        if (errors.length > 0) {
          throw new Error(errors[0].message);
        }

        // Process farmers count
        setTotalFarmers(farmersResult.count);

        // Process harvest data
        const harvestData = harvestResult.data;
        const sumRawQuantity = harvestData.reduce((sum, harvest) => 
          sum + (harvest.coffee_raw_quantity || 0), 0);
        setTotalHarvests(sumRawQuantity);

        // Process plant data
        const plantData = plantResult.data;
        const sumTotalTrees = plantData.reduce((sum, plant) => 
          sum + (plant.number_of_tree_planted || 0), 0);
        setTotalPlants(sumTotalTrees);

        // Process grade distribution data
        const totalFine = harvestData.reduce((sum, h) => sum + (h.coffee_fine_grade || 0), 0);
        const totalPremium = harvestData.reduce((sum, h) => sum + (h.coffee_premium_grade || 0), 0);
        const totalCommercial = harvestData.reduce((sum, h) => sum + (h.coffee_commercial_grade || 0), 0);
        const totalGrades = totalFine + totalPremium + totalCommercial;

        setGradeDistributionData({
          labels: [
            `Fine Grade\n${((totalFine / totalGrades) * 100).toFixed(1)}%\n(${totalFine.toFixed(1)} kg)`,
            `Premium Grade\n${((totalPremium / totalGrades) * 100).toFixed(1)}%\n(${totalPremium.toFixed(1)} kg)`,
            `Commercial Grade\n${((totalCommercial / totalGrades) * 100).toFixed(1)}%\n(${totalCommercial.toFixed(1)} kg)`
          ],
          datasets: [{
            data: [
              ((totalFine / totalGrades) * 100).toFixed(1),
              ((totalPremium / totalGrades) * 100).toFixed(1),
              ((totalCommercial / totalGrades) * 100).toFixed(1)
            ],
            backgroundColor: ['#6b4226', '#d2a679', '#f8d3ac'],
            hoverBackgroundColor: ['#8c5c3e', '#e0b58e', '#fae2bb']
          }]
        });

        // Process seasonal harvest data
        const monthlyHarvests = harvestData.reduce((acc, harvest) => {
          if (harvest.harvest_date && harvest.coffee_raw_quantity) {
            const date = new Date(harvest.harvest_date);
            const monthYear = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
            acc[monthYear] = (acc[monthYear] || 0) + harvest.coffee_raw_quantity;
          }
          return acc;
        }, {});

        const sortedMonths = Object.keys(monthlyHarvests).sort();
        
        setSeasonalHarvestData({
          labels: sortedMonths.map(my => {
            const [year, month] = my.split('-');
            const date = new Date(year, parseInt(month) - 1);
            return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
          }),
          datasets: [{
            label: 'Total Raw Coffee Harvest (kg)',
            data: sortedMonths.map(my => monthlyHarvests[my]),
            fill: false,
            borderColor: '#6b4226',
            tension: 0.1,
            pointBackgroundColor: '#d2a679',
            pointBorderColor: '#6b4226',
          }]
        });

        // Process recent activities
        const activities = {
          registrations: (recentFarmersResult.data || []).map(f => ({
            date: new Date(f.created_at).toLocaleDateString(),
            activity: "New Farmer Registration",
            farmer: `${f.first_name || 'N/A'} ${f.last_name || ''}`,
            status: "Completed"
          })),
          harvests: (recentHarvestsResult.data || []).map(h => ({
            date: new Date(h.harvest_date).toLocaleDateString(),
            activity: "Harvest Recorded",
            farmer: `${h.farmer_detail?.users?.first_name || 'N/A'} ${h.farmer_detail?.users?.last_name || ''}`,
            status: "Completed"
          }))
        };

        // Sort each activity group by date
        Object.keys(activities).forEach(key => {
          activities[key].sort((a, b) => new Date(b.date) - new Date(a.date));
        });

        setRecentActivities(activities);

        // Process data for DSS and Predictive Analytics
        const farmerPerformance = (await supabase.from('harvest_data').select('farmer_id, coffee_dry_quantity, farmer_detail(users(first_name, last_name))')).data;
        const gradeData = {
          premium: totalPremium,
          fine: totalFine,
          commercial: totalCommercial,
        };

        generateDssRecommendations(farmerPerformance, gradeData, farmersResult.data);

        // --- Predictive Analytics: Expected Yield Growth & Projected Average Yield ---
        const yearlyTotals = {};
        const yearlyFarmers = {};
        harvestData.forEach(harvest => {
          if (!harvest.harvest_date || !harvest.coffee_dry_quantity || !harvest.farmer_id) return;
          const year = new Date(harvest.harvest_date).getFullYear();
          yearlyTotals[year] = (yearlyTotals[year] || 0) + Number(harvest.coffee_dry_quantity);
          yearlyFarmers[year] = yearlyFarmers[year] || new Set();
          yearlyFarmers[year].add(harvest.farmer_id);
        });
        const years = Object.keys(yearlyTotals).sort();
        let avgYieldByYear = {};
        years.forEach(year => {
          const farmerCount = yearlyFarmers[year] ? yearlyFarmers[year].size : 0;
          avgYieldByYear[year] = farmerCount > 0 ? yearlyTotals[year] / farmerCount : 0;
        });
        let expectedYieldGrowth = 0;
        let projectedAvgYield = 0;
        if (years.length >= 2) {
          const lastYear = years[years.length - 2];
          const thisYear = years[years.length - 1];
          const lastAvg = avgYieldByYear[lastYear];
          const thisAvg = avgYieldByYear[thisYear];
          expectedYieldGrowth = lastAvg > 0 ? (thisAvg - lastAvg) / lastAvg : 0;
          projectedAvgYield = thisAvg * (1 + expectedYieldGrowth);
        } else if (years.length === 1) {
          const thisYear = years[0];
          const thisAvg = avgYieldByYear[thisYear];
          expectedYieldGrowth = 0;
          projectedAvgYield = thisAvg;
        }

        // --- Performance Categories (existing logic, unchanged) ---
        const farmerNameMap = new Map();
        farmerPerformance.forEach(harvest => {
            if (harvest.farmer_id && harvest.farmer_detail && harvest.farmer_detail.users) {
                farmerNameMap.set(harvest.farmer_id, `${harvest.farmer_detail.users.first_name} ${harvest.farmer_detail.users.last_name}`);
            }
        });
        
        const farmerYields = farmerPerformance.reduce((acc, harvest) => {
            if(harvest.farmer_id && harvest.coffee_dry_quantity) {
                 acc[harvest.farmer_id] = (acc[harvest.farmer_id] || 0) + harvest.coffee_dry_quantity;
            }
            return acc;
        }, {});

        const farmerPerformances = Object.entries(farmerYields).map(([farmerId, totalYield]) => ({
          farmerId,
          name: farmerNameMap.get(farmerId) || 'Unknown Farmer',
          avgYield: totalYield / (farmerPerformance.filter(h => h.farmer_id === farmerId).length || 1)
        }));

        const sortedYields = farmerPerformances.map(f => f.avgYield).sort((a, b) => b - a);
        const highPerformanceThreshold = sortedYields.length > 0 ? sortedYields[Math.floor(sortedYields.length * 0.2)] || 0 : 0;
        const lowPerformanceThreshold = sortedYields.length > 0 ? sortedYields[Math.floor(sortedYields.length * 0.8)] || 0 : 0;
        
        const high_farmers = farmerPerformances.filter(f => f.avgYield >= highPerformanceThreshold);
        const average_farmers = farmerPerformances.filter(f => f.avgYield < highPerformanceThreshold && f.avgYield > lowPerformanceThreshold);
        const needsSupport_farmers = farmerPerformances.filter(f => f.avgYield <= lowPerformanceThreshold);

        setPredictiveMetrics({
          expectedYield: projectedAvgYield,
          growthRate: expectedYieldGrowth,
          performanceCategories: {
            high: {
                count: high_farmers.length,
                farmers: high_farmers.map(f => f.name)
            },
            average: {
                count: average_farmers.length,
                farmers: average_farmers.map(f => f.name)
            },
            needsSupport: {
                count: needsSupport_farmers.length,
                farmers: needsSupport_farmers.map(f => f.name)
            }
          }
        });

      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
        setError(`Failed to load dashboard data: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [navigate, user]);

  const generateDssRecommendations = (farmerPerformance, gradeDistribution, allFarmers) => {
    const recommendations = [];
    const lowPerformers = farmerPerformance.filter(f => f.totalYield < 50); // Example threshold
  
    // Recommendation for underperforming farmers
    if (lowPerformers.length > 2) {
      recommendations.push({
        type: 'Action',
        title: 'Support Underperforming Farmers',
        description: `More than ${lowPerformers.length} farmers have a total yield below 50kg. Consider targeted training or resource allocation for these farmers.`
      });
    }
  
    // Recommendation based on grade distribution
    const totalGrades = gradeDistribution.premium + gradeDistribution.fine + gradeDistribution.commercial;
    if (totalGrades > 0 && (gradeDistribution.commercial / totalGrades) > 0.4) {
      recommendations.push({
        type: 'Warning',
        title: 'High Commercial Grade Ratio',
        description: 'Over 40% of the coffee is commercial grade. Investigate farming practices to improve quality and increase premium yields.'
      });
    }
  
    // Opportunity for top performers
    const topPerformer = farmerPerformance[0];
    if (topPerformer) {
      recommendations.push({
        type: 'Opportunity',
        title: 'Leverage Top Performers',
        description: `A top performer is leading in yields. Analyze their methods and share best practices with other farmers.`
      });
    }
  
    setDssRecommendations(recommendations);
  };

  // Fetch all activity logs for admin
  useEffect(() => {
    const fetchActivityLogs = async () => {
      if (!user || user.role !== "admin") return;
      setLogsLoading(true);
      setLogsError("");
      try {
        const { data, error } = await supabase
          .from("activity_log")
          .select(`*, user:user_id(first_name, last_name, email), farmer:farmer_id(id, users(first_name, last_name, email))`)
          .order("created_at", { ascending: false });
        if (error) throw error;
        setActivityLogs(data || []);
      } catch (err) {
        setLogsError("Failed to load activity logs.");
      } finally {
        setLogsLoading(false);
      }
    };
    fetchActivityLogs();
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const adminLinks = [
    { name: "Dashboard", path: "/dashboard" },
    { name: "Farmer Management", path: "/user-management" },
    { name: "Predictive Analytics", path: "/predictive-analytics" },
    { name: "DSS Recommendations", path: "/dss-recommendations" },
    { name: "Farmer Report", path: "/farmer-reports" },
    { name: "Coffee Grade Predictor", path: "/coffee-grader" },
  ];

  const farmerNavLinks = [
    { name: "Dashboard", path: "/farmer-dashboard" }, // This should go to farmer dashboard
    { name: "User Profile", path: "/user-profile" }, // Consistent with farmer
    { name: "Predictive Analytics", path: "/predictive-analytics" },
    { name: "DSS Recommendations", path: "/dss-recommendations" },
    { name: "Coffee Grade Predictor", path: "/coffee-grader" },
    { name: "Land & Plant Declaration", path: "/land-declaration" },
    { name: "Harvest Reporting", path: "/harvest-reporting" },
  ];

  const navLinks = user?.role === "admin" ? adminLinks : farmerNavLinks;

  // Helper to convert snake_case to Title Case
  function toTitleCase(str) {
    return str
      .replace(/_/g, ' ')
      .replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
  }

  // Helper to render a field-by-field summary for create/delete actions
  function renderFieldList(data, valueColor) {
    if (!data || typeof data !== 'object') return null;
    return (
      <ul className="mb-2">
        {Object.entries(data).map(([key, value]) => (
          <li key={key} className="mb-1">
            <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{toTitleCase(key)}:</span> <span className={
              valueColor === 'green' ? 'text-green-600' :
              valueColor === 'red' ? 'text-red-600' :
              ''
            }>{String(value)}</span>
          </li>
        ))}
      </ul>
    );
  }


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white p-6 rounded-lg shadow">
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                  <div className="h-8 bg-gray-200 rounded w-3/4"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center space-x-4">
              <div className="text-4xl">☕</div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Logout
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900">Total Farmers</h3>
              <p className="mt-2 text-3xl font-bold text-indigo-600">{totalFarmers}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900">Total Harvests (kg)</h3>
              <p className="mt-2 text-3xl font-bold text-indigo-600">{totalHarvests}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900">Total Plants</h3>
              <p className="mt-2 text-3xl font-bold text-indigo-600">{totalPlants}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Overall Farmer Grade Distribution</h3>
              <div className="h-64">
                <Pie data={gradeDistributionData} options={{ maintainAspectRatio: false }} />
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Seasonal Harvest</h3>
              <div className="h-64">
                <Line data={seasonalHarvestData} options={{ maintainAspectRatio: false }} />
              </div>
            </div>
          </div>
          
          {/* Recent Activities Section */}
          <div className={`rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-6`}>
            <div className="flex justify-between items-center mb-6">
              <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Recent Activities</h2>
              {user?.role === 'admin' && (
                <button
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-700 text-white hover:bg-gray-800 transition-colors duration-200"
                  onClick={() => setShowLogsModal(true)}
                >
                  View All Activity Logs
                </button>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Farmer Registrations */}
              <div>
                <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                  New Farmer Registrations
                </h3>
                <div className={`space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-transparent hover:scrollbar-thumb-gray-500 ${
                  isDarkMode ? 'scrollbar-thumb-gray-600 hover:scrollbar-thumb-gray-500' : ''
                }`}>
                  {recentActivities.registrations?.length > 0 ? (
                    recentActivities.registrations.map((activity, index) => (
                      <div
                        key={`registration-${index}`}
                        className={`p-4 rounded-lg ${
                          isDarkMode ? 'bg-gray-700' : 'bg-gray-50'
                        } hover:shadow-md transition-shadow duration-200`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {activity.farmer}
                            </p>
                            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              {activity.activity}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              {activity.date}
                            </p>
                            <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                              activity.status === "Completed"
                                ? isDarkMode
                                  ? 'bg-green-900 text-green-200'
                                  : 'bg-green-100 text-green-800'
                                : isDarkMode
                                  ? 'bg-yellow-900 text-yellow-200'
                                  : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {activity.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      No recent farmer registrations
                    </p>
                  )}
                </div>
              </div>

              {/* Harvest Records */}
              <div>
                <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                  Recent Harvest Records
                </h3>
                <div className={`space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-transparent hover:scrollbar-thumb-gray-500 ${
                  isDarkMode ? 'scrollbar-thumb-gray-600 hover:scrollbar-thumb-gray-500' : ''
                }`}>
                  {recentActivities.harvests?.length > 0 ? (
                    recentActivities.harvests.map((activity, index) => (
                      <div
                        key={`harvest-${index}`}
                        className={`p-4 rounded-lg ${
                          isDarkMode ? 'bg-gray-700' : 'bg-gray-50'
                        } hover:shadow-md transition-shadow duration-200`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {activity.farmer}
                            </p>
                            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              {activity.activity}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              {activity.date}
                            </p>
                            <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                              activity.status === "Completed"
                                ? isDarkMode
                                  ? 'bg-green-900 text-green-200'
                                  : 'bg-green-100 text-green-800'
                                : isDarkMode
                                  ? 'bg-yellow-900 text-yellow-200'
                                  : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {activity.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      No recent harvest records
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {navLinks.map((link) => (
              <button
                key={link.path}
                onClick={() => navigate(link.path)}
                className="px-4 py-2 text-sm font-medium text-indigo-600 bg-white border border-indigo-600 rounded-md hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                {link.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // If not admin, the component would have already redirected.
  if (user?.role !== "admin") {
      return null;
  }

  return (
    <Layout>
      <div className={`max-w-7xl mx-auto`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className={`mb-8 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6`}>
            <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Dashboard Overview</h1>
            {user && (
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Welcome back, {user.first_name} {user.last_name}
              </p>
            )}
          </div>

          {/* Admin Activity Log Modal */}
          {user?.role === 'admin' && showLogsModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-5xl w-full p-6 relative" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
                <button
                  className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  onClick={() => setShowLogsModal(false)}
                  aria-label="Close"
                >
                  &times;
                </button>
                <h2 className="text-xl font-bold mb-4 text-center dark:text-white">All Farmers' Activity Log</h2>
                {/* Filters */}
                <div className="flex flex-col md:flex-row gap-4 mb-4 justify-center items-center">
                <div>
                    <label className="block text-xs font-semibold mb-1 text-gray-700 dark:text-gray-200">Farmer</label>
                    <select
                      className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                      value={farmerFilter}
                      onChange={e => setFarmerFilter(e.target.value)}
                    >
                      <option value="All">All Farmers</option>
                      {[...new Set(activityLogs
                        .filter(log => log.farmer && log.farmer.users)
                        .map(log => `${log.farmer.users.first_name} ${log.farmer.users.last_name}`)
                        .filter(Boolean)
                      )].sort().map(farmerName => (
                        <option key={farmerName} value={farmerName}>{farmerName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-gray-700 dark:text-gray-200">What Was Changed</label>
                    <select
                      className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                      value={entityFilter}
                      onChange={e => setEntityFilter(e.target.value)}
                    >
                      <option value="All">All</option>
                      {[...new Set(activityLogs.map(log => log.entity_type).filter(Boolean))].map(entity => (
                        <option key={entity} value={entity}>{entity}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-gray-700 dark:text-gray-200">Action</label>
                    <select
                      className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                      value={actionFilter}
                      onChange={e => setActionFilter(e.target.value)}
                    >
                      <option value="All">All</option>
                      {[...new Set(activityLogs.map(log => log.action).filter(Boolean))].map(action => (
                        <option key={action} value={action}>{action}</option>
                      ))}
                    </select>
                  </div>

                </div>
                {logsLoading ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-300">Loading logs...</div>
                ) : logsError ? (
                  <div className="text-center py-8 text-red-500">{logsError}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead>
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">Date/Time</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">Farmer</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">What Was Changed</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">Action</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">Summary</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activityLogs.filter(log => {
                          const entityMatch = entityFilter === 'All' || log.entity_type === entityFilter;
                          const actionMatch = actionFilter === 'All' || log.action === actionFilter;
                          const farmerMatch = farmerFilter === 'All' || 
                            (log.farmer && log.farmer.users && 
                             `${log.farmer.users.first_name} ${log.farmer.users.last_name}` === farmerFilter);
                          return entityMatch && actionMatch && farmerMatch;
                        }).length === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-center py-6 text-gray-500 dark:text-gray-300">No activity logs found.</td>
                          </tr>
                        ) : (
                          activityLogs.filter(log => {
                            const entityMatch = entityFilter === 'All' || log.entity_type === entityFilter;
                            const actionMatch = actionFilter === 'All' || log.action === actionFilter;
                            const farmerMatch = farmerFilter === 'All' || 
                              (log.farmer && log.farmer.users && 
                               `${log.farmer.users.first_name} ${log.farmer.users.last_name}` === farmerFilter);
                            return entityMatch && actionMatch && farmerMatch;
                          }).map((log) => {
                            const isExpanded = expandedLogRows.includes(log.log_id);
                            let oldData = null, newData = null, diff = [];
                            try { oldData = log.old_data ? JSON.parse(log.old_data) : null; } catch {}
                            try { newData = log.new_data ? JSON.parse(log.new_data) : null; } catch {}
                            if (log.action === 'update' && oldData && newData) {
                              diff = Object.keys({ ...oldData, ...newData }).filter(key => oldData[key] !== newData[key]);
                            }
                            return (
                              <React.Fragment key={log.log_id}>
                                <tr className={isDarkMode ? 'bg-gray-700' : 'bg-white'}>
                              <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{new Date(log.created_at).toLocaleString()}</td>
                              <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{log.farmer && log.farmer.users ? `${log.farmer.users.first_name} ${log.farmer.users.last_name}` : log.farmer_id}</td>
                              <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{log.entity_type}</td>
                              <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{log.action}</td>
                                  <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                                    {log.change_summary || '-'}
                                    {(oldData || newData) && (
                                      <button
                                        className="ml-2 px-2 py-1 text-xs rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800"
                                        onClick={() => setExpandedLogRows(rows => rows.includes(log.log_id) ? rows.filter(id => id !== log.log_id) : [...rows, log.log_id])}
                                      >
                                        {isExpanded ? 'Hide Details' : 'Details'}
                                      </button>
                                    )}
                                  </td>
                                </tr>
                                {isExpanded && (
                                  <tr className={isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}>
                                    <td colSpan={5} className="px-4 py-2 text-xs">
                                      {log.action === 'update' && oldData && newData && diff.length > 0 && (
                                        <div>
                                          <div className={`font-semibold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Changed Fields:</div>
                                          <ul className="mb-2">
                                            {diff.map(key => (
                                              <li key={key} className="mb-1">
                                                <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{toTitleCase(key)}:</span> <span className="text-red-600">{String(oldData[key])}</span> <span className="mx-1">→</span> <span className="text-green-600">{String(newData[key])}</span>
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                      {log.action === 'create' && newData && (
                                        <div>
                                          <div className={`font-semibold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Created Fields:</div>
                                          {renderFieldList(newData, 'green')}
                                        </div>
                                      )}
                                      {log.action === 'delete' && oldData && (
                                        <div>
                                          <div className={`font-semibold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Deleted Fields:</div>
                                          {renderFieldList(oldData, 'red')}
                                        </div>
                                      )}
                                      {log.action === 'update' && (!oldData || !newData || diff.length === 0) && (
                                        <div className="italic text-gray-500">No detailed changes available.</div>
                                      )}
                                    </td>
                            </tr>
                                )}
                              </React.Fragment>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Stats Grid - Single Row */}
          <div className="flex flex-row gap-6 mb-8">
            <div className={`flex-1 p-6 rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h3 className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Total Farmers</h3>
              <p className={`mt-2 text-3xl font-bold ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>{totalFarmers}</p>
            </div>
            <div className={`flex-1 p-6 rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h3 className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Total Harvests (kg)</h3>
              <p className={`mt-2 text-3xl font-bold ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>{totalHarvests}</p>
            </div>
            <div className={`flex-1 p-6 rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h3 className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Total Plants</h3>
              <p className={`mt-2 text-3xl font-bold ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>{totalPlants}</p>
            </div>
          </div>

          {/* Charts Grid - Single Row */}
          <div className="flex flex-row gap-6 mb-8">
            <div className={`flex-1 p-6 rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h3 className={`text-lg font-medium mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Overall Farmer Grade Distribution</h3>
              <div className="h-64">
                <Pie data={gradeDistributionData} options={{ maintainAspectRatio: false }} />
              </div>
            </div>
            <div className={`flex-1 p-6 rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h3 className={`text-lg font-medium mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Seasonal Harvest</h3>
              <div className="h-64">
                <Line data={seasonalHarvestData} options={{ maintainAspectRatio: false }} />
              </div>
            </div>
          </div>

          {/* DSS and Predictive Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <AdminDSS recommendations={dssRecommendations} isDarkMode={isDarkMode} />
          <div className="space-y-6">
            {/* <div className={`p-6 rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h3 className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Expected Yield Growth
              </h3>
              <p className={`mt-2 text-3xl font-bold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                {(predictiveMetrics.growthRate * 100).toFixed(1)}%
              </p>
            </div>
            <div className={`p-6 rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h3 className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Projected Average Yield
              </h3>
              <p className={`mt-2 text-3xl font-bold ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
                {predictiveMetrics.expectedYield.toFixed(1)} kg
              </p>
            </div> */}
            <div className={`p-6 rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h3 className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Performance Distribution
              </h3>
              <div className="mt-2 space-y-2">
                <div className="flex justify-between items-center">
                  <div>
                    <span className={isDarkMode ? 'text-green-400' : 'text-green-600'}>High</span>
                    <button onClick={() => setExpandedCategories(prev => ({...prev, high: !prev.high}))} className="ml-2 text-xs text-gray-400">(show/hide)</button>
                  </div>
                  <span className="font-bold">{predictiveMetrics.performanceCategories.high.count}</span>
                </div>
                {expandedCategories.high && (
                    <ul className="list-disc list-inside text-sm text-gray-500">
                        {predictiveMetrics.performanceCategories.high.farmers.map(name => <li key={name}>{name}</li>)}
                    </ul>
                )}
                <div className="flex justify-between items-center">
                  <div>
                    <span className={isDarkMode ? 'text-blue-400' : 'text-blue-600'}>Average</span>
                    <button onClick={() => setExpandedCategories(prev => ({...prev, average: !prev.average}))} className="ml-2 text-xs text-gray-400">(show/hide)</button>
                  </div>
                  <span className="font-bold">{predictiveMetrics.performanceCategories.average.count}</span>
                </div>
                 {expandedCategories.average && (
                    <ul className="list-disc list-inside text-sm text-gray-500">
                        {predictiveMetrics.performanceCategories.average.farmers.map(name => <li key={name}>{name}</li>)}
                    </ul>
                )}
                <div className="flex justify-between items-center">
                  <div>
                    <span className={isDarkMode ? 'text-orange-400' : 'text-orange-600'}>Needs Support</span>
                    <button onClick={() => setExpandedCategories(prev => ({...prev, needsSupport: !prev.needsSupport}))} className="ml-2 text-xs text-gray-400">(show/hide)</button>
                  </div>
                  <span className="font-bold">{predictiveMetrics.performanceCategories.needsSupport.count}</span>
                </div>
                {expandedCategories.needsSupport && (
                    <ul className="list-disc list-inside text-sm text-gray-500">
                        {predictiveMetrics.performanceCategories.needsSupport.farmers.map(name => <li key={name}>{name}</li>)}
                    </ul>
                )}
              </div>
            </div>
          </div>
        </div>

          {/* Recent Activities Section */}
          <div className={`rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-6`}>
            <div className="flex justify-between items-center mb-6">
              <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Recent Activities</h2>
              {user?.role === 'admin' && (
                <button
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-700 text-white hover:bg-gray-800 transition-colors duration-200"
                  onClick={() => setShowLogsModal(true)}
                >
                  View All Activity Logs
                </button>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Farmer Registrations */}
              <div>
                <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                  New Farmer Registrations
                </h3>
                <div className={`space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-transparent hover:scrollbar-thumb-gray-500 ${
                  isDarkMode ? 'scrollbar-thumb-gray-600 hover:scrollbar-thumb-gray-500' : ''
                }`}>
                  {recentActivities.registrations?.length > 0 ? (
                    recentActivities.registrations.map((activity, index) => (
                      <div
                        key={`registration-${index}`}
                        className={`p-4 rounded-lg ${
                          isDarkMode ? 'bg-gray-700' : 'bg-gray-50'
                        } hover:shadow-md transition-shadow duration-200`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {activity.farmer}
                            </p>
                            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              {activity.activity}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              {activity.date}
                            </p>
                            <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                              activity.status === "Completed"
                                ? isDarkMode
                                  ? 'bg-green-900 text-green-200'
                                  : 'bg-green-100 text-green-800'
                                : isDarkMode
                                  ? 'bg-yellow-900 text-yellow-200'
                                  : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {activity.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      No recent farmer registrations
                    </p>
                  )}
                </div>
              </div>

              {/* Harvest Records */}
              <div>
                <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                  Recent Harvest Records
                </h3>
                <div className={`space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-transparent hover:scrollbar-thumb-gray-500 ${
                  isDarkMode ? 'scrollbar-thumb-gray-600 hover:scrollbar-thumb-gray-500' : ''
                }`}>
                  {recentActivities.harvests?.length > 0 ? (
                    recentActivities.harvests.map((activity, index) => (
                      <div
                        key={`harvest-${index}`}
                        className={`p-4 rounded-lg ${
                          isDarkMode ? 'bg-gray-700' : 'bg-gray-50'
                        } hover:shadow-md transition-shadow duration-200`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {activity.farmer}
                            </p>
                            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              {activity.activity}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              {activity.date}
                            </p>
                            <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                              activity.status === "Completed"
                                ? isDarkMode
                                  ? 'bg-green-900 text-green-200'
                                  : 'bg-green-100 text-green-800'
                                : isDarkMode
                                  ? 'bg-yellow-900 text-yellow-200'
                                  : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {activity.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      No recent harvest records
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;