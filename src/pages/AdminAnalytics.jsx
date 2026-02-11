import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthProvider';
import { useTheme } from '../lib/ThemeContext';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabaseClient';
import { Line, Bar, Pie, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import PredictResult from '../components/analytics/PredictResult';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import CoffeeSampleGrading from './CoffeeSampleGrading';
import AdminDSS from '../components/analytics/AdminDSS';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const AdminAnalytics = () => {
  const { user } = useAuth();
  const { isDarkMode } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Data states
  const [totalFarmers, setTotalFarmers] = useState(0);
  const [activeFarmers, setActiveFarmers] = useState(0);
  const [averageYieldPerFarmer, setAverageYieldPerFarmer] = useState(0);
  const [topPerformingFarmers, setTopPerformingFarmers] = useState([]);
  const [dssRecommendations, setDssRecommendations] = useState([]);

  // Chart data states
  const [yearlyProductivity, setYearlyProductivity] = useState({
    labels: [],
    datasets: [{
      label: 'Average Yield per Farmer (kg)',
      data: [],
      borderColor: 'rgb(75, 192, 192)',
      tension: 0.1
    }]
  });

  const [farmerGrowthTrend, setFarmerGrowthTrend] = useState({
    labels: [],
    datasets: [{
      label: 'Number of Active Farmers',
      data: [],
      borderColor: 'rgb(54, 162, 235)',
      tension: 0.1
    }]
  });

  const [gradeDistribution, setGradeDistribution] = useState({
    labels: ['Premium Grade', 'Fine Grade', 'Commercial Grade'],
    datasets: [{
      data: [0, 0, 0],
      backgroundColor: [
        'rgba(75, 192, 192, 0.8)',  // Premium - Teal
        'rgba(54, 162, 235, 0.8)',  // Fine - Blue
        'rgba(255, 206, 86, 0.8)',  // Commercial - Gold
      ],
      borderWidth: 0,
      hoverOffset: 4
    }]
  });

  const [averageTreesPerFarmer, setAverageTreesPerFarmer] = useState(0);
  const [totalActivePlants, setTotalActivePlants] = useState(0);
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

  // Add state for prediction form and result
  const [inputData, setInputData] = useState(null);
  const [form, setForm] = useState({
    moisture: '',
    ph: '',
    odor_score: '',
    defect_count: ''
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setInputData(form);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();

    // Title
    doc.setFontSize(18);
    doc.text('Land & Plant Declaration', 14, 18);

    // Date
    doc.setFontSize(10);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 26);

    // Farm Details Section
    doc.setFontSize(14);
    doc.text('Farm Details', 14, 36);
    doc.setFontSize(11);
    doc.text(`Location: ${farmerDetails.farm_location || '-'}`, 14, 44);
    doc.text(`Size: ${farmerDetails.farm_size || '-'} hectares`, 14, 52);
    doc.text(`Elevation: ${farmerDetails.farm_elevation || '-'} meters`, 14, 60);

    // Plant Data Table
    if (plantDataList.length > 0) {
      doc.setFontSize(14);
      doc.text('Coffee Plants', 14, 72);

      doc.autoTable({
        startY: 76,
        head: [['Variety', 'Planting Date', 'Number of Trees']],
        body: plantDataList.map(plant => [
          plant.coffee_variety,
          plant.planting_date ? new Date(plant.planting_date).toLocaleDateString() : '',
          plant.number_of_tree_planted
        ]),
        theme: 'grid',
        headStyles: { fillColor: [34, 197, 94] }, // Tailwind green-600
      });
    }

    // Save the PDF
    doc.save('Land_Plant_Declaration.pdf');
  };

  const [farmersData, setFarmersData] = useState([]);

  useEffect(() => {
    const fetchFarmerAnalytics = async () => {
      try {
        setLoading(true);
        
        // Fetch data in parallel
        const [
          farmersDataResp,
          harvestData,
          plantData
        ] = await Promise.all([
          // Basic farmer data
          supabase
            .from('farmer_detail')
            .select(`
              id,
              farm_location,
              farm_size,
              farm_elevation,
              created_at,
              users (
                first_name,
                last_name
              )
            `),
          
          // Harvest data by farmer
          supabase
            .from('harvest_data')
            .select(`
              farmer_id,
              harvest_date,
              coffee_raw_quantity,
              coffee_dry_quantity,
              coffee_premium_grade,
              coffee_fine_grade,
              coffee_commercial_grade,
              farmer_detail (
                farm_elevation,
                users (
                  first_name,
                  last_name
                )
              )
            `)
            .order('harvest_date', { ascending: true }),
          
          // Plant data for all farmers
          supabase
            .from('plant_data')
            .select('farmer_id, number_of_tree_planted, elevation, cluster_size')
        ]);

        if (farmersDataResp.error || harvestData.error || plantData.error) {
          throw new Error('Error fetching farmer data');
        }

        setFarmersData(farmersDataResp.data);
        // Process basic farmer metrics
        setTotalFarmers(farmersDataResp.data.length);
        
        // Calculate active farmers (those with harvests in the last 6 months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const activeCount = new Set(
          harvestData.data
            .filter(h => new Date(h.harvest_date) >= sixMonthsAgo)
            .map(h => h.farmer_id)
        ).size;
        setActiveFarmers(activeCount);

        // Calculate total trees and average trees per farmer
        const farmerTrees = {};
        let totalTrees = 0;

        // First, calculate total trees for each farmer
        plantData.data.forEach(plant => {
          if (plant.farmer_id) {
            farmerTrees[plant.farmer_id] = (farmerTrees[plant.farmer_id] || 0) + (plant.number_of_tree_planted || 0);
            totalTrees += (plant.number_of_tree_planted || 0);
          }
        });

        // Calculate average trees (only for farmers who have trees)
        const farmersWithTrees = Object.keys(farmerTrees).length;
        const avgTrees = farmersWithTrees > 0 ? Math.round(totalTrees / farmersWithTrees) : 0;

        setAverageTreesPerFarmer(avgTrees);
        setTotalActivePlants(totalTrees);

        // Calculate coffee grade distribution
        const gradeData = {
          premium: 0,
          fine: 0,
          commercial: 0
        };

        harvestData.data.forEach(harvest => {
          gradeData.premium += Number(harvest.coffee_premium_grade) || 0;
          gradeData.fine += Number(harvest.coffee_fine_grade) || 0;
          gradeData.commercial += Number(harvest.coffee_commercial_grade) || 0;
        });

        setGradeDistribution(prev => ({
          ...prev,
          datasets: [{
            ...prev.datasets[0],
            data: [gradeData.premium, gradeData.fine, gradeData.commercial]
          }]
        }));

        // Process top performing farmers
        const farmerYields = harvestData.data.reduce((acc, harvest) => {
          acc[harvest.farmer_id] = (acc[harvest.farmer_id] || 0) + (harvest.coffee_dry_quantity || 0);
          return acc;
        }, {});

        const farmerPerformance = Object.entries(farmerYields)
          .map(([farmerId, totalYield]) => {
            const farmer = farmersDataResp.data.find(f => f.id === farmerId);
            return {
              id: farmerId,
              name: `${farmer?.users?.first_name} ${farmer?.users?.last_name}`,
              totalYield,
              location: farmer?.farm_location
            };
          })
          .sort((a, b) => b.totalYield - a.totalYield)
          .slice(0, 5);
        setTopPerformingFarmers(farmerPerformance);

        // Process yearly productivity
        const yearlyData = {};
        const yearlyFarmerCounts = {};
        
        harvestData.data.forEach(harvest => {
          const year = new Date(harvest.harvest_date).getFullYear();
          if (!yearlyData[year]) {
            yearlyData[year] = 0;
            yearlyFarmerCounts[year] = new Set();
          }
          yearlyData[year] += (harvest.coffee_dry_quantity || 0);
          yearlyFarmerCounts[year].add(harvest.farmer_id);
        });

        // Calculate average yield per farmer per year
        const years = Object.keys(yearlyData).sort();
        const avgYields = years.map(year => 
          (yearlyFarmerCounts[year].size > 0 ? yearlyData[year] / yearlyFarmerCounts[year].size : 0)
        );

        setYearlyProductivity({
          labels: years,
          datasets: [{
            label: 'Average Yield per Farmer (kg)',
            data: avgYields,
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.5)',
            tension: 0.1
          }]
        });

        // Calculate farmer growth trend
        const farmersByYear = years.map(year => 
          yearlyFarmerCounts[year].size
        );

        setFarmerGrowthTrend({
          labels: years,
          datasets: [{
            label: 'Number of Active Farmers',
            data: farmersByYear,
            borderColor: 'rgb(54, 162, 235)',
            backgroundColor: 'rgba(54, 162, 235, 0.5)',
            tension: 0.1
          }]
        });

        // --- Predictive Analytics Calculations ---
        let expectedYieldGrowth = 0;
        let projectedAvgYield = 0;
        if (years.length >= 2) {
          const lastYearAvg = avgYields[avgYields.length - 2];
          const thisYearAvg = avgYields[avgYields.length - 1];
          expectedYieldGrowth = lastYearAvg > 0 ? (thisYearAvg - lastYearAvg) / lastYearAvg : 0;
          projectedAvgYield = thisYearAvg * (1 + expectedYieldGrowth);
        } else if (years.length === 1) {
          projectedAvgYield = avgYields[0];
        }

        // --- Debugging Logs ---
        console.log('[AdminAnalytics] Yearly Data:', yearlyData);
        console.log('[AdminAnalytics] Yearly Farmer Counts:', yearlyFarmerCounts);
        console.log('[AdminAnalytics] Avg Yields by Year:', avgYields);
        console.log('[AdminAnalytics] Growth & Yield:', { expectedYieldGrowth, projectedAvgYield });

        // Calculate performance categories
        const farmerNameMap = new Map();
        farmersDataResp.data.forEach(f => {
            if (f.id && f.users) {
                farmerNameMap.set(f.id, `${f.users.first_name} ${f.users.last_name}`);
            }
        });

        const farmerPerformances = Object.entries(farmerYields).map(([farmerId, totalYield]) => ({
          farmerId,
          name: farmerNameMap.get(farmerId) || 'Unknown Farmer',
          avgYield: totalYield / (harvestData.data.filter(h => h.farmer_id === farmerId).length || 1)
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

        // Generate DSS recommendations
        generateDssRecommendations(farmerPerformance, gradeData, farmersDataResp.data);


      } catch (err) {
        console.error('Error fetching farmer analytics:', err);
        setError('Failed to load farmer analytics. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchFarmerAnalytics();
  }, []);

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
        description: `Farmer ${topPerformer.name} is a top performer. Analyze their methods and share best practices with other farmers.`
      });
    }
  
    setDssRecommendations(recommendations);
  };

  // Calculate average farm_elevation for use as altitude (or use 0 if not available)
  const averageElevation = React.useMemo(() => {
    if (!Array.isArray(farmersData) || farmersData.length === 0) return 0;
    const elevations = farmersData.map(f => Number(f.farm_elevation) || 0).filter(e => e > 0);
    if (elevations.length === 0) return 0;
    return Math.round(elevations.reduce((a, b) => a + b, 0) / elevations.length);
  }, [farmersData]);

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className={`p-6 rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                  <div className="h-8 bg-gray-200 rounded w-3/4"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="px-4 sm:px-6 lg:px-8 py-8">
          <div className={`mb-8 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6`}>
            <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Analytics
            </h1>
            {user && (
              <p className={`mt-2 text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-700'}`}>
                Welcome back, {user.first_name} {user.last_name}
              </p>
            )}
            <p className={`mt-2 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-700'}`}>
              Comprehensive overview of farmer performance and trends
            </p>
          </div>

          {/* Coffee Grade Prediction (R API) - moved up */}
          {/* <div className={`mb-8 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6`}>
            <h2 className={`text-xl font-semibold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Coffee Grade Prediction (R API)</h2>
            <CoffeeSampleGrading
              altitude={averageElevation}
              onSubmit={(sample) => {
                // TODO: Call the R API here and handle the result
                alert('Sample submitted: ' + JSON.stringify(sample, null, 2));
              }}
              isDarkMode={isDarkMode}
            />
          </div> */}

          {/* Current Farmer Analytics */}
          <div className="mt-8">
            <h2 className={`text-xl font-semibold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Current Farmer Metrics
            </h2>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className={`p-6 rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                <h3 className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Farmers</h3>
                <p className={`mt-2 text-3xl font-bold ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
                  {totalFarmers}
                </p>
              </div>
              <div className={`p-6 rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                <h3 className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Active Farmers</h3>
                <p className={`mt-2 text-3xl font-bold ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
                  {activeFarmers}
                </p>
              </div>
              <div className={`p-6 rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                <h3 className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Avg Trees/Farmer</h3>
                <p className={`mt-2 text-3xl font-bold ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
                  {Math.round(averageTreesPerFarmer)}
                </p>
              </div>
              <div className={`p-6 rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                <h3 className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Active Plants</h3>
                <p className={`mt-2 text-3xl font-bold ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
                  {totalActivePlants}
                </p>
              </div>
            </div>

            {/* Top Performers and Grade Distribution Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className={`p-6 rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                <h3 className={`text-lg font-medium mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Top Performers
                </h3>
                <div className="space-y-4">
                  {topPerformingFarmers.slice(0, 3).map((farmer, index) => (
                    <div key={farmer.id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white
                          ${index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-orange-500'}`}>
                          {index + 1}
                        </div>
                        <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
                          {farmer.name}
                        </span>
                      </div>
                      <span className={`font-medium ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
                        {farmer.totalYield.toFixed(1)} kg
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`p-6 rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                <h3 className={`text-lg font-medium mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Coffee Grade Distribution
                </h3>
                <div className="relative h-64">
                  <Doughnut
                    data={gradeDistribution}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      cutout: '60%',
                      plugins: {
                        legend: {
                          position: 'bottom',
                          labels: {
                            color: isDarkMode ? '#D1D5DB' : '#4B5563',
                            padding: 20,
                            font: {
                              size: 12
                            }
                          }
                        }
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Yearly Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className={`p-6 rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                <h3 className={`text-lg font-medium mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Yearly Productivity
                </h3>
                <div className="h-64">
                  <Line
                    data={yearlyProductivity}
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
                            color: isDarkMode ? '#D1D5DB' : '#4B5563'
                          }
                        },
                        x: {
                          grid: {
                            color: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                          },
                          ticks: {
                            color: isDarkMode ? '#D1D5DB' : '#4B5563'
                          }
                        }
                      },
                      plugins: {
                        legend: {
                          labels: {
                            color: isDarkMode ? '#D1D5DB' : '#4B5563'
                          }
                        }
                      }
                    }}
                  />
                </div>
              </div>

              <div className={`p-6 rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                <h3 className={`text-lg font-medium mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Farmer Growth Trend
                </h3>
                <div className="h-64">
                  <Line
                    data={farmerGrowthTrend}
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
                            color: isDarkMode ? '#D1D5DB' : '#4B5563'
                          }
                        },
                        x: {
                          grid: {
                            color: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                          },
                          ticks: {
                            color: isDarkMode ? '#D1D5DB' : '#4B5563'
                          }
                        }
                      },
                      plugins: {
                        legend: {
                          labels: {
                            color: isDarkMode ? '#D1D5DB' : '#4B5563'
                          }
                        }
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Predictive Analytics Section */}
            <div className="mt-12 mb-8">
              <h2 className={`text-xl font-semibold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Decision Support & Predictive Analytics
              </h2>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* DSS Component */}
                <AdminDSS recommendations={dssRecommendations} isDarkMode={isDarkMode} />

                {/* Predictive Metrics */}
                <div className="space-y-6">
                  {/* <div className={`p-6 rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                    <h3 className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Expected Yield Growth
                    </h3>
                    <p className={`mt-2 text-3xl font-bold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                      {(predictiveMetrics.growthRate * 100).toFixed(1)}%
                    </p>
                    <p className={`mt-1 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Projected annual growth rate
                    </p>
                  </div>

                  <div className={`p-6 rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                    <h3 className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Projected Average Yield
                    </h3>
                    <p className={`mt-2 text-3xl font-bold ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
                      {predictiveMetrics.expectedYield.toFixed(1)} kg
                    </p>
                    <p className={`mt-1 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Expected yield per farmer next year
                    </p>
                  </div> */}

                  <div className={`p-6 rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                    <h3 className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Performance Distribution
                    </h3>
                    <div className="mt-2 space-y-2">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className={isDarkMode ? 'text-green-400' : 'text-green-600'}>High Performing</span>
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
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default AdminAnalytics;