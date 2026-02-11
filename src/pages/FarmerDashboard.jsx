import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useTheme } from "../lib/ThemeContext";
import "../styles/Styles.css"; // Ensure your styles are imported
import Layout from '../components/Layout';

// Import Chart.js components
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useRef } from 'react';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const FarmerDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDarkMode, toggleTheme } = useTheme();
  const [user, setUser] = useState(null);
  const [farmerDetails, setFarmerDetails] = useState(null); // Will be null if no details declared
  const [plants, setPlants] = useState([]); // Add plants state
  const [statuses, setStatuses] = useState({}); // Add statuses state
  const [totalFarmerPlants, setTotalFarmerPlants] = useState(0); // Sum of trees
  const [totalRawHarvests, setTotalRawHarvests] = useState(0); // Sum of raw quantity
  const [totalDryHarvests, setTotalDryHarvests] = useState(0); // Sum of dry quantity
  const [totalPremiumKg, setTotalPremiumKg] = useState(0); // Sum of premium grade in Kg
  const [totalFineKg, setTotalFineKg] = useState(0);       // Sum of fine grade in Kg
  const [totalCommercialKg, setTotalCommercialKg] = useState(0); // Sum of commercial grade in Kg
  const [recentFarmerActivities, setRecentFarmerActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [harvestData, setHarvestData] = useState([]);
  const [isHarvestModalOpen, setIsHarvestModalOpen] = useState(false);
  const [isPlantsModalOpen, setIsPlantsModalOpen] = useState(false);
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
  const [activityLogs, setActivityLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState("");
  const [isRecentActivitiesModalOpen, setIsRecentActivitiesModalOpen] = useState(false);
  const [entityFilter, setEntityFilter] = useState('All');
  const [actionFilter, setActionFilter] = useState('All');
  const [expandedLogRows, setExpandedLogRows] = useState([]);
  // PDF preview modal state
  const [isPdfPreviewOpen, setIsPdfPreviewOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const pdfDocRef = useRef(null);

  // State for Chart Data
  const [harvestBarChartData, setHarvestBarChartData] = useState({
    labels: ['Raw Harvest', 'Dry Harvest'],
    datasets: [{
      label: 'Coffee Quantity (kg)',
      data: [0, 0],
      backgroundColor: ['rgba(75, 192, 192, 0.6)', 'rgba(153, 102, 255, 0.6)'],
      borderColor: ['rgba(75, 192, 192, 1)', 'rgba(153, 102, 255, 1)'],
      borderWidth: 1,
    }]
  });

  const [gradePieChartData, setGradePieChartData] = useState({
    labels: ['Premium', 'Fine', 'Commercial'],
    datasets: [{
      label: 'Grade Distribution (%)',
      data: [0, 0, 0],
      backgroundColor: [
        'rgba(255, 99, 132, 0.6)',
        'rgba(54, 162, 235, 0.6)',
        'rgba(255, 206, 86, 0.6)',
      ],
      borderColor: [
        'rgba(255, 99, 132, 1)',
        'rgba(54, 162, 235, 1)',
        'rgba(255, 206, 86, 1)',
      ],
      borderWidth: 1,
    }]
  });

  // Add new state for legend data
  const [legendData, setLegendData] = useState([
    { label: 'Premium', percentage: 0, value: 0, color: 'rgba(255, 99, 132, 0.6)' },
    { label: 'Fine', percentage: 0, value: 0, color: 'rgba(54, 162, 235, 0.6)' },
    { label: 'Commercial', percentage: 0, value: 0, color: 'rgba(255, 206, 86, 0.6)' }
  ]);

  // Add getStatusColor function
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'healthy':
        return isDarkMode 
          ? 'bg-green-900 text-green-200' 
          : 'bg-green-100 text-green-800';
      case 'diseased':
        return isDarkMode 
          ? 'bg-red-900 text-red-200' 
          : 'bg-red-100 text-red-800';
      case 'pest-affected':
        return isDarkMode 
          ? 'bg-yellow-900 text-yellow-200' 
          : 'bg-yellow-100 text-yellow-800';
      default:
        return isDarkMode 
          ? 'bg-gray-700 text-gray-200' 
          : 'bg-gray-100 text-gray-800';
    }
  };

  // Add handlePlantClick function
  const handlePlantClick = (plant) => {
    navigate(`/plant-status/${plant.plant_id}`);
  };

  // Fetch activity logs for the current farmer
  const fetchActivityLogs = async (farmerId) => {
    setLogsLoading(true);
    setLogsError("");
    try {
      const { data, error } = await supabase
        .from("activity_log")
        .select(`*, user:user_id(first_name, last_name, email)`)
        .eq("farmer_id", farmerId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setActivityLogs(data || []);
    } catch (err) {
      setLogsError("Failed to load activity logs.");
    } finally {
      setLogsLoading(false);
    }
  };

  // Open logs modal and fetch logs
  const handleOpenLogsModal = () => {
    if (user?.id) fetchActivityLogs(user.id);
    setIsLogsModalOpen(true);
  };

  useEffect(() => {
    const fetchFarmerDashboardData = async () => {
      setLoading(true);
      setError("");

      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        navigate("/login");
        return;
      }
      // Set the base user info (auth user)
      setUser(authUser);

      // Fetch user's role and full name from 'users' table
      const { data: userData, error: userDetailsError } = await supabase
        .from("users")
        .select("first_name, last_name, email, role")
        .eq("email", authUser.email)
        .single();

      if (userDetailsError) {
        console.error("Error fetching user details:", userDetailsError.message);
        setError("Failed to fetch your user profile. Please try again.");
        setLoading(false);
        return;
      }
      // Update user state with details including role and names
      setUser(prevUser => ({ ...prevUser, ...userData }));

      // --- Access Control: Only allow farmers ---
      if (userData?.role !== "farmer") {
        setError("Access Denied: Only farmers can view this dashboard.");
        setLoading(false);
        // Optionally redirect to a generic dashboard or login if not a farmer
        // navigate("/dashboard", { replace: true });
        return;
      }
      // --- End Access Control ---

      try {
        // Fetch specific farmer details using user.id
        // Handle case where farmer_detail might not exist (new user)
        const { data: farmerData, error: farmerDetailError } = await supabase
          .from("farmer_detail")
          .select("id, farm_location, farm_size, farm_elevation")
          .eq("id", authUser.id) // IMPORTANT: Filter by the authenticated user's ID
          .single();

        if (farmerDetailError && farmerDetailError.code !== 'PGRST116') { // PGRST116 means no rows found, which is expected for new farmers
          throw farmerDetailError; // Re-throw other unexpected errors
        }

        // If farmerData is null (no details yet), farmerDetails will remain null, and the UI will show default.
        // If farmerData is found, set it.
        setFarmerDetails(farmerData);

        // Fetch plant data
        const { data: plantData, error: plantsError } = await supabase
          .from("plant_data")
          .select("*")
          .eq("farmer_id", authUser.id);
        if (plantsError) throw plantsError;

        setPlants(plantData);

        // Fetch latest status for each plant
        const newStatuses = {};
        for (const plant of plantData) {
          const { data: statusData, error: statusError } = await supabase
            .from('plant_status')
            .select('*')
            .eq('plant_id', plant.plant_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          if (!statusError && statusData) {
            newStatuses[plant.plant_id] = statusData;
          }
        }
        setStatuses(newStatuses);

        // Sum up the number_of_tree_planted
        const sumTotalTrees = plantData.reduce((sum, plant) => sum + (plant.number_of_tree_planted || 0), 0);
        setTotalFarmerPlants(sumTotalTrees);

        // Fetch ALL relevant Harvest data for this farmer
        const { data: harvestData, error: harvestsError } = await supabase
          .from("harvest_data")
          .select("coffee_raw_quantity, coffee_dry_quantity, coffee_premium_grade, coffee_fine_grade, coffee_commercial_grade, harvest_date, plant_id") // Select all relevant columns
          .eq("farmer_id", authUser.id); // IMPORTANT: Filter by farmer's ID
        if (harvestsError) throw harvestsError;
        setHarvestData(harvestData); // <-- Add this line to store for modal

        // Sum up the coffee quantities
        const sumRawQuantity = harvestData.reduce((sum, harvest) => sum + (harvest.coffee_raw_quantity || 0), 0);
        setTotalRawHarvests(sumRawQuantity);

        const sumDryQuantity = harvestData.reduce((sum, harvest) => sum + (harvest.coffee_dry_quantity || 0), 0);
        setTotalDryHarvests(sumDryQuantity);

        // Calculate total Kg for each grade (using dry quantity as base)
        const sumPremiumKg = harvestData.reduce((sum, harvest) => {
          const dryQuantity = harvest.coffee_dry_quantity || 0;
          const premiumPercentage = harvest.coffee_premium_grade || 0;
          return sum + (dryQuantity * (premiumPercentage / 100));
        }, 0);
        setTotalPremiumKg(Math.round(sumPremiumKg * 100) / 100);

        const sumFineKg = harvestData.reduce((sum, harvest) => {
          const dryQuantity = harvest.coffee_dry_quantity || 0;
          const finePercentage = harvest.coffee_fine_grade || 0;
          return sum + (dryQuantity * (finePercentage / 100));
        }, 0);
        setTotalFineKg(Math.round(sumFineKg * 100) / 100);

        const sumCommercialKg = harvestData.reduce((sum, harvest) => {
          const dryQuantity = harvest.coffee_dry_quantity || 0;
          const commercialPercentage = harvest.coffee_commercial_grade || 0;
          return sum + (dryQuantity * (commercialPercentage / 100));
        }, 0);
        setTotalCommercialKg(Math.round(sumCommercialKg * 100) / 100);

        // Update Chart Data
        setHarvestBarChartData({
          labels: ['Raw Harvest', 'Dry Harvest'],
          datasets: [{
            label: 'Coffee Quantity (kg)',
            data: [sumRawQuantity, sumDryQuantity],
            backgroundColor: ['rgba(75, 192, 192, 0.6)', 'rgba(153, 102, 255, 0.6)'],
            borderColor: ['rgba(75, 192, 192, 1)', 'rgba(153, 102, 255, 1)'],
            borderWidth: 1,
          }]
        });

        // Calculate total graded yield and percentages for pie chart
        const totalGradedYield = sumPremiumKg + sumFineKg + sumCommercialKg;
        
        // Calculate percentages
        const premiumPercentage = totalGradedYield > 0 ? (sumPremiumKg / totalGradedYield) * 100 : 0;
        const finePercentage = totalGradedYield > 0 ? (sumFineKg / totalGradedYield) * 100 : 0;
        const commercialPercentage = totalGradedYield > 0 ? (sumCommercialKg / totalGradedYield) * 100 : 0;

        // Update Pie Chart with percentage distribution
        setGradePieChartData({
          labels: ['Premium', 'Fine', 'Commercial'],
          datasets: [{
            label: 'Grade Distribution (%)',
            data: [
              Math.round(premiumPercentage * 10) / 10,    // Round to 1 decimal place
              Math.round(finePercentage * 10) / 10,
              Math.round(commercialPercentage * 10) / 10
            ],
            backgroundColor: [
              'rgba(255, 99, 132, 0.6)', // Premium - Pink/Red
              'rgba(54, 162, 235, 0.6)', // Fine - Blue
              'rgba(255, 206, 86, 0.6)', // Commercial - Yellow
            ],
            borderColor: [
              'rgba(255, 99, 132, 1)',
              'rgba(54, 162, 235, 1)',
              'rgba(255, 206, 86, 1)',
            ],
            borderWidth: 1,
          }]
        });

        // Update the legend data when updating pie chart
        setLegendData([
          { 
            label: 'Premium', 
            percentage: Math.round(premiumPercentage * 10) / 10,
            value: Math.round(sumPremiumKg * 100) / 100,
            color: 'rgba(255, 99, 132, 0.6)'
          },
          { 
            label: 'Fine', 
            percentage: Math.round(finePercentage * 10) / 10,
            value: Math.round(sumFineKg * 100) / 100,
            color: 'rgba(54, 162, 235, 0.6)'
          },
          { 
            label: 'Commercial', 
            percentage: Math.round(commercialPercentage * 10) / 10,
            value: Math.round(sumCommercialKg * 100) / 100,
            color: 'rgba(255, 206, 86, 0.6)'
          }
        ]);

        // Fetch Recent Activities for this farmer
        // Get recent plant declarations
        const { data: recentPlants, error: recentPlantsError } = await supabase
          .from("plant_data")
          .select("planting_date, coffee_variety")
          .eq("farmer_id", authUser.id)
          .order("planting_date", { ascending: false })
          .limit(3);

        // Get recent harvest records (use the already fetched harvestData for activities)
        // Sort the fetched harvestData by date for recent activities
        const sortedRecentHarvests = [...harvestData].sort((a, b) => new Date(b.harvest_date) - new Date(a.harvest_date)).slice(0, 3);


        let activities = [];
        if (!recentPlantsError && recentPlants) {
          activities = activities.concat(recentPlants.map(p => ({
            date: new Date(p.planting_date).toLocaleDateString(),
            activity: `New Plant Declaration: ${p.coffee_variety}`,
            status: "Completed"
          })));
        } else if (recentPlantsError) {
          console.error("Error fetching recent plants:", recentPlantsError);
        }

        if (sortedRecentHarvests) { // Use sortedRecentHarvests directly
          activities = activities.concat(sortedRecentHarvests.map(h => ({
            date: new Date(h.harvest_date).toLocaleDateString(),
            activity: "Harvest Recorded",
            status: "Completed"
          })));
        }
        // No need for else if (recentHarvestsError) here, as we're using already fetched data.

        // Sort activities by date in descending order and limit to top 5
        activities.sort((a, b) => new Date(b.date) - new Date(a.date));
        setRecentFarmerActivities(activities.slice(0, 5));

      } catch (err) {
        console.error("Failed to fetch farmer dashboard data:", err);
        setError(`Failed to load your dashboard data: ${err.message}`);
        // If a critical error occurs, it should still show the error state.
      } finally {
        setLoading(false);
      }
    };

    fetchFarmerDashboardData();
  }, [navigate]); // navigate is a dependency

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  // Navigation links for farmer dashboard
  const farmerNavLinks = [
    { name: "Dashboard", path: "/farmer-dashboard" }, // This new dashboard
    { name: "User Profile", path: "/user-profile" },
    { name: "Predictive Analytics", path: "/predictive-analytics" },
    { name: "DSS Recommendations", path: "/dss-recommendations" },
    { name: "Land & Plant Declaration", path: "/land-declaration" },
    { name: "Harvest Reporting", path: "/harvest-reporting" },
  ];

  const navLinks = farmerNavLinks;

  // Chart options for Bar Graph (Harvests)
  const harvestBarChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Raw vs. Dry Coffee Harvest (kg)',
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
                label += ': ';
            }
            if (context.parsed.y !== null) {
                label += context.parsed.y.toFixed(2) + ' kg';
            }
            return label;
          }
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Harvest Type',
        },
      },
      y: {
        title: {
          display: true,
          text: 'Quantity (kg)',
        },
        beginAtZero: true,
      },
    },
  };

  // Chart options for Pie Chart (Graded Yield)
  const gradePieChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Distribution of Graded Yield (kg)',
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            let label = context.label || '';
            if (label) {
                label += ': ';
            }
            if (context.parsed !== null) {
                label += context.parsed.toFixed(2) + ' kg';
            }
            return label;
          }
        }
      }
    },
  };

  // Add this custom legend component
  const CustomLegend = ({ data }) => (
    <div className="flex flex-col gap-4 p-4">
      {data.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <div 
            className="w-4 h-4 rounded-full" 
            style={{ backgroundColor: item.color }}
          />
          <div className="flex flex-col">
            <span className="font-medium">{item.label}</span>
            <div className="text-sm text-gray-600 dark:text-gray-300">
              <span>{item.percentage}%</span>
              <span className="mx-1">•</span>
              <span>{item.value} kg</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  // Helper to get Top Grade
  const getTopGrade = () => {
    const grades = [
      { label: 'Premium', value: totalPremiumKg },
      { label: 'Fine', value: totalFineKg },
      { label: 'Commercial', value: totalCommercialKg },
    ];
    const top = grades.reduce((prev, curr) => (curr.value > prev.value ? curr : prev), grades[0]);
    return top.value > 0 ? top.label : 'N/A';
  };

  // Forecasted Revenue (simple: dry harvest * price per kg)
  const pricePerKg = 5; // USD per kg (placeholder)
  const forecastedRevenue = totalDryHarvests * pricePerKg;

  // Generate PDF and show preview modal
  const handleExportPDF = (download = false) => {
    try {
      let farmerName = user?.fullName || (user?.first_name ? `${user.first_name} ${user.last_name || ''}` : '');
      if (!farmerName && farmerDetails?.first_name) {
        farmerName = `${farmerDetails.first_name} ${farmerDetails.last_name || ''}`;
      }
      farmerName = (farmerName || '-').trim();
      const doc = new jsPDF();
      pdfDocRef.current = doc;
    // Title
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Farmer Dashboard Report', 14, 18);
    doc.setFont('helvetica', 'normal');
    // Date & Farmer
    doc.setFontSize(11);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 26);
    doc.text(`Farmer: ${farmerName}`, 14, 32);
    // Divider
    doc.setLineWidth(0.5);
    doc.line(14, 35, 196, 35);
    // Farm Summary Table
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Farm Summary', 14, 43);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    let summaryLines = doc.splitTextToSize('This section gives you a quick overview of your farm: your best bean quality, expected income, total number of coffee trees, and your recent harvest amounts.', 180);
    doc.text(summaryLines, 14, 48);
    let nextY = 48 + summaryLines.length * 5 + 4;
    autoTable(doc, {
      startY: nextY,
      head: [['Top Grade', 'Forecasted Revenue', 'Total Plants', 'Raw Harvest (kg)', 'Dry Harvest (kg)']],
      body: [[
        getTopGrade(),
        `$${forecastedRevenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`,
        totalFarmerPlants,
        totalRawHarvests,
        totalDryHarvests
      ]],
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246], fontStyle: 'bold' },
      styles: { fontSize: 11, cellPadding: 2 },
    });
    nextY = doc.lastAutoTable.finalY + 8;
    // Predictive Analytics Section
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Predictive Analytics', 14, nextY);
    doc.setFont('helvetica', 'normal');
    nextY += 4;
    doc.setFontSize(10);
    doc.text('Summary:', 14, nextY);
    let predSummaryLines = doc.splitTextToSize(getPredictiveAnalyticsSummary(), 170);
    doc.text(predSummaryLines, 28, nextY);
    nextY += predSummaryLines.length * 5 + 4;
    let predExplainLines = doc.splitTextToSize('This section estimates your next harvest and the quality of your beans, based on your recent data. It also gives you tips to help you get the best results.', 180);
    doc.text(predExplainLines, 14, nextY);
    nextY += predExplainLines.length * 5 + 4;
    autoTable(doc, {
      startY: nextY,
      head: [['Projected Next Harvest Yield', 'Premium (kg)', 'Fine (kg)', 'Commercial (kg)']],
      body: [[
        totalDryHarvests > 0 ? `${(totalDryHarvests * 1.1).toFixed(1)} kg` : 'N/A',
        totalPremiumKg,
        totalFineKg,
        totalCommercialKg
      ]],
      theme: 'grid',
      headStyles: { fillColor: [34, 197, 94], fontStyle: 'bold' },
      styles: { fontSize: 11, cellPadding: 2 },
    });
    nextY = doc.lastAutoTable.finalY + 8;
    // Quick Recommendations Section
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Quick Recommendations', 14, nextY);
    doc.setFont('helvetica', 'normal');
    nextY += 6;
    doc.setFontSize(10);
    doc.text('Summary:', 14, nextY);
    let dssSummaryLines = doc.splitTextToSize(getDssSummary(), 170);
    doc.text(dssSummaryLines, 28, nextY);
    nextY += dssSummaryLines.length * 5 + 4;
    let dssExplainLines = doc.splitTextToSize('These are simple steps you can take right now to help your coffee plants grow better and stay healthy.', 180);
    doc.text(dssExplainLines, 14, nextY);
    nextY += dssExplainLines.length * 5 + 4;
    const quickRecs = [
      'Keep soil pH between 5.5 and 6.5 for best results.',
      'Water regularly, especially during dry or hot months.',
      'Watch for signs of disease or pests and act quickly.',
      'Apply fertilizer after each harvest for better yield.',
      'Check your plant health status for specific tips.'
    ];
    quickRecs.forEach((rec, i) => {
      doc.text(`• ${rec}`, 18, nextY + i * 6);
    });
    nextY += quickRecs.length * 6 + 8;
    // DSS Recommendations Section
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('DSS Recommendations', 14, nextY);
    doc.setFont('helvetica', 'normal');
    nextY += 4;
    doc.setFontSize(10);
    let dssRecExplainLines = doc.splitTextToSize('This section gives you more advice based on your farm data and best practices for the season. Use these tips to improve your yield and quality.', 180);
    doc.text(dssRecExplainLines, 14, nextY);
    nextY += dssRecExplainLines.length * 5 + 4;
    // Key Recommendations (static summary)
    autoTable(doc, {
      startY: nextY,
      head: [['Focus Area', 'Advice']],
      body: [
        ['Increase yield', 'Fertilize and prune regularly if yield per tree is low.'],
        ['Improve quality', 'Focus on cherry selection and better processing for more premium beans.'],
        ['Optimize land', 'Plant more trees if you have extra space.'],
        ['Harvest often', 'Schedule regular harvests for better quality and yield.'],
        ['Use shade', 'If your farm is at low elevation, provide shade for better quality.']
      ],
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129], fontStyle: 'bold' },
      styles: { fontSize: 11, cellPadding: 2 },
    });
    nextY = doc.lastAutoTable.finalY + 8;
    
    // Plant Clusters Status Section
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Plant Clusters Status', 14, nextY);
    doc.setFont('helvetica', 'normal');
    nextY += 4;
    doc.setFontSize(10);
    let plantClustersExplainLines = doc.splitTextToSize('This section shows the current status of each of your plant clusters, including health status, quality performance, and specific recommendations for improvement.', 180);
    doc.text(plantClustersExplainLines, 14, nextY);
    nextY += plantClustersExplainLines.length * 5 + 4;
    
    if (plants.length === 0) {
      doc.setFontSize(11);
      doc.text('No plant clusters declared yet. Please declare your plant clusters to get detailed status and recommendations.', 14, nextY);
      nextY += 8;
    } else {
      // Plant Clusters Summary Table
      autoTable(doc, {
        startY: nextY,
        head: [['Cluster', 'Variety', 'Trees', 'Elevation (MASL)', 'Health Status', 'Quality Category', 'Avg Yield (kg/tree)']],
        body: plants.map(plant => {
          try {
            const plantStatus = statuses[plant.plant_id];
            const plantHarvests = harvestData.filter(h => h.plant_id === plant.plant_id);
            const totalYield = plantHarvests.reduce((sum, h) => sum + (h.coffee_raw_quantity || 0), 0);
            const avgYield = plantHarvests.length > 0 ? totalYield / plantHarvests.length : 0;
            
            // Calculate quality grades for this plant
            const premiumGrade = plantHarvests.reduce((sum, h) => sum + (h.coffee_premium_grade || 0), 0) / Math.max(plantHarvests.length, 1);
            const fineGrade = plantHarvests.reduce((sum, h) => sum + (h.coffee_fine_grade || 0), 0) / Math.max(plantHarvests.length, 1);
            const commercialGrade = plantHarvests.reduce((sum, h) => sum + (h.coffee_commercial_grade || 0), 0) / Math.max(plantHarvests.length, 1);
            
            // Determine quality category
            let qualityCategory = 'Mixed';
            if (premiumGrade >= 40) qualityCategory = 'Premium';
            else if (fineGrade >= 40) qualityCategory = 'Fine';
            else if (commercialGrade >= 60) qualityCategory = 'Commercial';
            
            return [
              `Cluster ${typeof plant.plant_id === 'string' ? plant.plant_id.slice(-4) : String(plant.plant_id || 'N/A')}`,
              plant.coffee_variety || 'Unknown',
              plant.number_of_tree_planted || 0,
              plant.elevation || 'N/A',
              plantStatus ? plantStatus.status : 'Unknown',
              qualityCategory,
              avgYield.toFixed(1)
            ];
          } catch (error) {
            console.error('Error processing plant for PDF:', error, plant);
            return [
              'Cluster Error',
              'Unknown',
              0,
              'N/A',
              'Unknown',
              'Mixed',
              '0.0'
            ];
          }
        }),
        theme: 'grid',
        headStyles: { fillColor: [75, 192, 192], fontStyle: 'bold' },
        styles: { fontSize: 10, cellPadding: 2 },
      });
      nextY = doc.lastAutoTable.finalY + 8;
      
      // Individual Cluster Details
      plants.forEach((plant, index) => {
        try {
          const plantStatus = statuses[plant.plant_id];
          const plantHarvests = harvestData.filter(h => h.plant_id === plant.plant_id);
          const totalYield = plantHarvests.reduce((sum, h) => sum + (h.coffee_raw_quantity || 0), 0);
          const avgYield = plantHarvests.length > 0 ? totalYield / plantHarvests.length : 0;
          
          // Calculate quality grades
          const premiumGrade = plantHarvests.reduce((sum, h) => sum + (h.coffee_premium_grade || 0), 0) / Math.max(plantHarvests.length, 1);
          const fineGrade = plantHarvests.reduce((sum, h) => sum + (h.coffee_fine_grade || 0), 0) / Math.max(plantHarvests.length, 1);
          const commercialGrade = plantHarvests.reduce((sum, h) => sum + (h.coffee_commercial_grade || 0), 0) / Math.max(plantHarvests.length, 1);
        
        // Generate recommendations
        const recommendations = [];
        if (plantStatus) {
          if (plantStatus.status === 'diseased') {
            recommendations.push('Implement disease management immediately');
          }
          if (plantStatus.status === 'pest-affected') {
            recommendations.push('Apply appropriate pest control measures');
          }
          if (plantStatus.soil_ph && (plantStatus.soil_ph < 5.5 || plantStatus.soil_ph > 6.5)) {
            recommendations.push(`Adjust soil pH (current: ${plantStatus.soil_ph}, optimal: 5.5-6.5)`);
          }
          if (plantStatus.moisture_level === 'dry') {
            recommendations.push('Increase irrigation frequency');
          }
        }
        if (premiumGrade < 30) {
          recommendations.push('Focus on cherry selection and processing for premium grade');
        }
        if (avgYield < 2) {
          recommendations.push('Consider fertilization and pruning for yield improvement');
        }
        if (plant.elevation) {
          if (plant.coffee_variety === 'Arabica' && plant.elevation < 900) {
            recommendations.push('Consider variety change or shade management for Arabica');
          }
          if (plant.coffee_variety === 'Robusta' && plant.elevation > 1200) {
            recommendations.push('Monitor for reduced yield at high elevation');
          }
        }
        if (recommendations.length === 0) {
          recommendations.push('Continue current maintenance practices');
        }
        
        // Cluster Header
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`${plant.coffee_variety} Cluster (${plant.number_of_tree_planted} trees)`, 14, nextY);
        doc.setFont('helvetica', 'normal');
        nextY += 6;
        
        // Cluster Details
        doc.setFontSize(10);
        doc.text(`Elevation: ${plant.elevation || 'N/A'} MASL`, 18, nextY);
        nextY += 5;
        doc.text(`Health Status: ${plantStatus ? plantStatus.status : 'Unknown'}`, 18, nextY);
        nextY += 5;
        doc.text(`Average Yield: ${avgYield.toFixed(1)} kg/tree`, 18, nextY);
        nextY += 5;
        doc.text(`Quality Grades - Premium: ${premiumGrade.toFixed(1)}%, Fine: ${fineGrade.toFixed(1)}%, Commercial: ${commercialGrade.toFixed(1)}%`, 18, nextY);
        nextY += 5;
        
        // Recommendations
        doc.setFont('helvetica', 'bold');
        doc.text('Recommendations:', 18, nextY);
        doc.setFont('helvetica', 'normal');
        nextY += 5;
        recommendations.slice(0, 3).forEach((rec, recIndex) => {
          doc.text(`• ${rec}`, 22, nextY);
          nextY += 5;
        });
        
        // Add space between clusters
        nextY += 4;
        
        // Check if we need a new page
        if (nextY > 250) {
          doc.addPage();
          nextY = 20;
        }
        } catch (error) {
          console.error('Error processing plant cluster for PDF:', error, plant);
          // Continue with next plant instead of breaking the entire PDF generation
        }
      });
    }
    
    // Best Practices (static summary)
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Best Practices', 14, nextY);
    doc.setFont('helvetica', 'normal');
    nextY += 6;
    doc.setFontSize(10);
    let bestPracticesExplainLines = doc.splitTextToSize('These are proven ways to take care of your coffee plants, from planting to harvesting. Following these can help you get better results.', 180);
    doc.text(bestPracticesExplainLines, 14, nextY);
    nextY += bestPracticesExplainLines.length * 5 + 4;
    const bestPractices = [
      { category: 'Planting', practices: [
        'Maintain proper spacing between trees (2-3 meters)',
        'Plant in well-draining soil',
        'Provide adequate shade for young plants'
      ]},
      { category: 'Maintenance', practices: [
        'Regular pruning to maintain tree shape',
        'Annual soil testing and amendment',
        'Proper weed management',
        'Regular pest and disease monitoring'
      ]},
      { category: 'Harvesting', practices: [
        'Selective picking of ripe cherries',
        'Proper sorting of harvested cherries',
        'Maintain clean processing equipment',
        'Monitor moisture content during drying'
      ]}
    ];
    bestPractices.forEach(cat => {
      doc.setFont('helvetica', 'bold');
      doc.text(`${cat.category}:`, 18, nextY);
      doc.setFont('helvetica', 'normal');
      nextY += 6;
      cat.practices.forEach(prac => {
        doc.text(`- ${prac}`, 22, nextY);
        nextY += 6;
      });
      nextY += 2;
    });
    // Seasonal Yield Forecast Table
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Seasonal Yield Forecast', 14, nextY);
    doc.setFont('helvetica', 'normal');
    nextY += 4;
    doc.setFontSize(10);
    let seasonalExplainLines = doc.splitTextToSize('This table shows how much you can expect to harvest in different seasons. Use this to plan your work and sales.', 180);
    doc.text(seasonalExplainLines, 14, nextY);
    nextY += seasonalExplainLines.length * 5 + 4;
    autoTable(doc, {
      startY: nextY,
      head: [['Season', 'Expected Yield (kg)']],
      body: [
        ['Peak', (totalDryHarvests * 1.2).toFixed(1)],
        ['Mid', (totalDryHarvests * 0.8).toFixed(1)],
        ['Off', (totalDryHarvests * 0.4).toFixed(1)]
      ],
      theme: 'grid',
      headStyles: { fillColor: [251, 191, 36], fontStyle: 'bold' },
      styles: { fontSize: 11, cellPadding: 2 },
    });
    nextY = doc.lastAutoTable.finalY + 8;
    // Divider
    doc.setLineWidth(0.3);
    doc.line(14, nextY, 196, nextY);
    nextY += 4;
    // Recent Harvests Table
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Recent Harvests', 14, nextY);
    doc.setFont('helvetica', 'normal');
    nextY += 4;
    doc.setFontSize(10);
    let recentHarvestsExplainLines = doc.splitTextToSize('Here are your most recent harvest records, including the type of beans and how much you picked. This helps you track your progress over time.', 180);
    doc.text(recentHarvestsExplainLines, 14, nextY);
    nextY += recentHarvestsExplainLines.length * 5 + 4;
    if (Array.isArray(harvestData) && harvestData.length > 0) {
      autoTable(doc, {
        startY: nextY,
        head: [['Date', 'Variety', 'Raw (kg)', 'Dry (kg)', 'Premium (%)', 'Fine (%)', 'Commercial (%)']],
        body: harvestData.slice(-5).map(h => [
          h.harvest_date ? new Date(h.harvest_date).toLocaleDateString() : '',
          plants.find(p => p.plant_id === h.plant_id)?.coffee_variety ?? '-',
          h.coffee_raw_quantity ?? '-',
          h.coffee_dry_quantity ?? '-',
          h.coffee_premium_grade ?? '-',
          h.coffee_fine_grade ?? '-',
          h.coffee_commercial_grade ?? '-'
        ]),
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246], fontStyle: 'bold' },
        styles: { fontSize: 11, cellPadding: 2 },
      });
      nextY = doc.lastAutoTable.finalY + 8;
    } else {
      doc.setFontSize(11);
      doc.text('No harvest data available.', 14, nextY);
      nextY += 8;
    }
    // Footer
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text('Generated by iKape Dashboard', 14, 285);
    // Show preview or download
    if (download) {
      const safeName = farmerName.replace(/[^a-zA-Z0-9]/g, '_');
      doc.save(`Farmer_Dashboard_${safeName}.pdf`);
    } else {
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      setIsPdfPreviewOpen(true);
    }
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

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

  // Helper to generate a plain-language summary for Predictive Analytics
  function getPredictiveAnalyticsSummary() {
    if (totalDryHarvests === 0) {
      return "No harvest data available yet. Once you record your first harvest, you'll see a summary here to help you plan ahead.";
    }
    let summary = `Based on your recent harvests, you can expect your next harvest to be around ${(totalDryHarvests * 1.1).toFixed(1)} kilograms. Most of your beans are likely to be `;
    // Find the top grade
    const grades = [
      { label: 'premium', value: totalPremiumKg },
      { label: 'fine', value: totalFineKg },
      { label: 'commercial', value: totalCommercialKg }
    ];
    const topGrade = grades.reduce((prev, curr) => (curr.value > prev.value ? curr : prev), grades[0]);
    summary += `${topGrade.label} quality`;
    summary += ". To keep your harvest healthy, make sure to water your plants regularly, check for any signs of pests or disease, and fertilize after each harvest. Your farm is doing well, but a little extra care can help you get even better results.";
    return summary;
  }

  // Helper to generate a plain-language summary for DSS Recommendations
  function getDssSummary() {
    return (
      "Right now, your farm can benefit from a few simple steps. Water your plants regularly, especially if the weather is dry. Use mulch to help the soil keep its moisture. Watch for any signs of pests or disease, and act quickly if you see any problems. If your farm is at a low elevation, providing some shade can help your coffee plants grow better. Keep up the good work, and remember that small improvements can make a big difference over time."
    );
  }

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className={`h-8 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} rounded w-1/4 mb-8`}></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
                  <div className={`h-4 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} rounded w-1/2 mb-4`}></div>
                  <div className={`h-8 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} rounded w-3/4`}></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Error</h1>
            <p className={`mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{error}</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className={`mb-8 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'} rounded-lg shadow-lg p-6`}>
          <h2 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Farmer Dashboard
          </h2>
          {user && (
            <p className={`mt-2 text-lg ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              Welcome back, <span className="font-semibold">{user.first_name} {user.last_name}</span>
            </p>
          )}
          <p className={`mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Monitor your farm's performance and activities
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/*Top Grade */}
          <div className={`p-6 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} hover:shadow-xl transition-shadow duration-200`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Top Grade</h3>
                <p className={`mt-2 font-bold truncate text-base md:text-lg lg:text-xl xl:text-2xl ${isDarkMode ? 'text-pink-400' : 'text-pink-600'}`}>{getTopGrade()}</p>
              </div>
            </div>
          </div>
          {/* Total Plants */}
          <div className={`p-6 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} hover:shadow-xl transition-shadow duration-200`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Total Plants</h3>
                <p className={`mt-2 font-bold truncate text-base md:text-lg lg:text-xl xl:text-2xl ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>{totalFarmerPlants}</p>
              </div>
            </div>
          </div>
          {/* Raw Harvest */}
          <div className={`p-6 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} hover:shadow-xl transition-shadow duration-200`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Raw Harvest</h3>
                <p className={`mt-2 font-bold truncate text-base md:text-lg lg:text-xl xl:text-2xl ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>{totalRawHarvests} kg</p>
              </div>
            </div>
          </div>
          {/* Dry Harvest */}
          <div className={`p-6 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} hover:shadow-xl transition-shadow duration-200`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Dry Harvest</h3>
                <p className={`mt-2 font-bold truncate text-base md:text-lg lg:text-xl xl:text-2xl ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>{totalDryHarvests} kg</p>
              </div>
            </div>
          </div>
        </div>
        {/* Action Buttons below Stats Grid */}
        <div className="flex flex-col md:flex-row gap-4 mb-8 justify-center items-center">
          <button
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors duration-200 w-full md:w-auto"
            onClick={() => navigate('/land-declaration')}
          >
            See My Plants
          </button>
          <button
            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 w-full md:w-auto"
            onClick={() => setIsHarvestModalOpen(true)}
          >
            View My Harvests
          </button>
          <button
            className="bg-amber-600 text-white px-6 py-2 rounded-lg hover:bg-amber-700 transition-colors duration-200 w-full md:w-auto"
            onClick={() => setIsPlantsModalOpen(true)}
          >
            Plant Health Status
          </button>
          <button
            className="bg-gray-700 text-white px-6 py-2 rounded-lg hover:bg-gray-800 transition-colors duration-200 w-full md:w-auto"
            onClick={handleOpenLogsModal}
          >
            View All Acivity Logs
          </button>
          <button
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 w-full md:w-auto"
            onClick={() => handleExportPDF(false)}
          >
            Export to PDF
          </button>
            </div>
        {/* Harvest History Modal */}
        {isHarvestModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className={`bg-gray-50 dark:bg-gray-800 rounded-lg shadow-lg max-w-2xl w-full p-6 relative max-h-[90vh] flex flex-col`}>
              <button
                className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                onClick={() => setIsHarvestModalOpen(false)}
                aria-label="Close"
              >
                &times;
              </button>
              <h2 className={`text-xl font-bold mb-4 text-center ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>My Harvest History</h2>
              <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0" style={{ maxHeight: '60vh' }}>
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead>
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">Date</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">Variety</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">Raw (kg)</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">Dry (kg)</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">Premium (%)</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">Fine (%)</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">Commercial (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(Array.isArray(harvestData) ? harvestData : []).map((h, idx) => {
                      const plant = plants.find(p => p.plant_id === h.plant_id);
                      return (
                        <tr key={idx} className="bg-white dark:bg-gray-700 even:bg-gray-50 dark:even:bg-gray-800">
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{h.harvest_date ? new Date(h.harvest_date).toLocaleDateString() : ''}</td>
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{plant ? plant.coffee_variety : '-'}</td>
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{h.coffee_raw_quantity ?? '-'}</td>
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{h.coffee_dry_quantity ?? '-'}</td>
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{h.coffee_premium_grade ?? '-'}</td>
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{h.coffee_fine_grade ?? '-'}</td>
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{h.coffee_commercial_grade ?? '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {(!Array.isArray(harvestData) || harvestData.length === 0) && (
                  <div className="text-center text-gray-500 dark:text-gray-300 py-4">No harvest records found.</div>
                )}
            </div>
              <div className="flex justify-end mt-4">
                <button
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200"
                  onClick={() => { setIsHarvestModalOpen(false); navigate('/harvest-reporting'); }}
                >
                  Go to Harvest Reporting
                </button>
          </div>
        </div>
          </div>
        )}
        {/* Plant Health Status Modal */}
        {isPlantsModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className={`bg-gray-50 dark:bg-gray-800 rounded-lg shadow-lg max-w-3xl w-full p-6 relative`}>
              <button
                className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                onClick={() => setIsPlantsModalOpen(false)}
                aria-label="Close"
              >
                &times;
              </button>
              <h2 className={`text-xl font-bold mb-4 text-center ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Your Current Plants</h2>
              <p className={`text-sm mb-4 text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Click on a plant to view its status and manage it.</p>
              <div className="p-2">
            {plants.length === 0 ? (
              <div className="text-center py-8">
                <p className={`mb-4 text-lg ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  Please declare plant first.
                </p>
                <button
                  className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors duration-200"
                      onClick={() => { setIsPlantsModalOpen(false); navigate('/land-declaration'); }}
                >
                  Declare Plant
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {plants.map((plant) => (
                  <div
                    key={plant.plant_id}
                    className={`p-6 rounded-lg shadow-md ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'} 
                      hover:shadow-lg transition-all duration-200 cursor-pointer`}
                    onClick={() => handlePlantClick(plant)}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                            <h3 className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{plant.coffee_variety}</h3>
                            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Trees: {plant.number_of_tree_planted}</p>
                            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Planted: {new Date(plant.planting_date).toLocaleDateString()}</p>
                      </div>
                      {statuses[plant.plant_id] && (
                        <div className={`px-4 py-2 rounded-full text-sm font-medium
                          ${getStatusColor(statuses[plant.plant_id].status)}`}>
                          {statuses[plant.plant_id].status}
                        </div>
                      )}
                      </div>
                    </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {/* Activity Log Modal */}
        {isLogsModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className={`bg-gray-50 dark:bg-gray-800 rounded-lg shadow-lg max-w-4xl w-full p-6 relative`}>
              <button
                className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                onClick={() => setIsLogsModalOpen(false)}
                aria-label="Close"
              >
                &times;
              </button>
              <h2 className={`text-xl font-bold mb-4 text-center ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Activity Log</h2>
              {/* Filters */}
              <div className="flex flex-col md:flex-row gap-4 mb-4 justify-center items-center">
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
                <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: '60vh' }}>
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead>
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">Date/Time</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">User</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">What Was Changed</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">Action</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">Summary</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activityLogs.filter(log =>
                        (entityFilter === 'All' || log.entity_type === entityFilter) &&
                        (actionFilter === 'All' || log.action === actionFilter)
                      ).length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-6 text-gray-500 dark:text-gray-300">No activity logs found.</td>
                        </tr>
                      ) : (
                        activityLogs.filter(log =>
                          (entityFilter === 'All' || log.entity_type === entityFilter) &&
                          (actionFilter === 'All' || log.action === actionFilter)
                        ).map((log) => {
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
                                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{log.user ? `${log.user.first_name} ${log.user.last_name}` : 'Unknown'}</td>
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
        {/* Add extra space below this section */}
        <div className="mb-10" />

        {/* Charts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className={`p-6 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} hover:shadow-xl transition-shadow duration-200`}>
            <h3 className={`text-lg font-medium mb-4 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Harvest Distribution</h3>
            <div className="h-64">
              <Bar data={harvestBarChartData} options={harvestBarChartOptions} />
            </div>
            {/* Bar chart totals legend */}
            <div className="flex flex-col md:flex-row gap-4 justify-center items-center mt-4">
              <div className="flex items-center gap-2">
                <span className="inline-block w-4 h-4 rounded" style={{ backgroundColor: 'rgba(75, 192, 192, 0.6)' }}></span>
                <span className="font-medium text-gray-700 dark:text-gray-200">Raw Harvest:</span>
                <span className="font-bold" style={{ color: 'rgb(75, 192, 192)' }}>{totalRawHarvests} kg</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-4 h-4 rounded" style={{ backgroundColor: 'rgba(153, 102, 255, 0.6)' }}></span>
                <span className="font-medium text-gray-700 dark:text-gray-200">Dry Harvest:</span>
                <span className="font-bold" style={{ color: 'rgb(153, 102, 255)' }}>{totalDryHarvests} kg</span>
              </div>
            </div>
                  </div>

          <div className={`p-6 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} hover:shadow-xl transition-shadow duration-200`}>
            <h3 className={`text-lg font-medium mb-4 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Overall Grade Distribution</h3>
            <div className="flex flex-col md:flex-row items-center justify-center gap-8">
              <div className="w-full md:w-1/2 max-w-md">
                <Pie data={gradePieChartData} options={gradePieChartOptions} />
              </div>
              <div className="w-full md:w-1/2 max-w-md">
                <CustomLegend data={legendData} />
              </div>
            </div>
          </div>
        </div>

        {/* Plant Clusters Status Section */}
        <div className={`mb-8 p-6 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} hover:shadow-xl transition-shadow duration-200`}>
          <div className="flex justify-between items-center mb-4">
            <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Plant Clusters Status</h2>
            <button
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 text-sm"
              onClick={() => navigate('/land-declaration')}
            >
              Manage Clusters
            </button>
          </div>
          
          {plants.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">🌱</div>
              <h3 className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                No Plant Clusters Found
              </h3>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-4`}>
                Start by declaring your plant clusters to get personalized recommendations.
              </p>
              <button
                className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors duration-200"
                onClick={() => navigate('/land-declaration')}
              >
                Declare Plant Clusters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {plants.map((plant) => {
                const plantStatus = statuses[plant.plant_id];
                const plantHarvests = harvestData.filter(h => h.plant_id === plant.plant_id);
                const totalYield = plantHarvests.reduce((sum, h) => sum + (h.coffee_raw_quantity || 0), 0);
                const avgYield = plantHarvests.length > 0 ? totalYield / plantHarvests.length : 0;
                
                // Calculate quality grades for this plant
                const premiumGrade = plantHarvests.reduce((sum, h) => sum + (h.coffee_premium_grade || 0), 0) / Math.max(plantHarvests.length, 1);
                const fineGrade = plantHarvests.reduce((sum, h) => sum + (h.coffee_fine_grade || 0), 0) / Math.max(plantHarvests.length, 1);
                const commercialGrade = plantHarvests.reduce((sum, h) => sum + (h.coffee_commercial_grade || 0), 0) / Math.max(plantHarvests.length, 1);
                
                // Determine quality category
                const getQualityCategory = () => {
                  if (premiumGrade >= 40) return { category: 'Premium', color: 'text-green-600', bgColor: 'bg-green-100', darkColor: 'text-green-400', darkBgColor: 'bg-green-900' };
                  if (fineGrade >= 40) return { category: 'Fine', color: 'text-blue-600', bgColor: 'bg-blue-100', darkColor: 'text-blue-400', darkBgColor: 'bg-blue-900' };
                  if (commercialGrade >= 60) return { category: 'Commercial', color: 'text-amber-600', bgColor: 'bg-amber-100', darkColor: 'text-amber-400', darkBgColor: 'bg-amber-900' };
                  return { category: 'Mixed', color: 'text-gray-600', bgColor: 'bg-gray-100', darkColor: 'text-gray-400', darkBgColor: 'bg-gray-700' };
                };
                
                const qualityCategory = getQualityCategory();
                
                // Generate recommendations based on plant data
                const getPlantRecommendations = () => {
                  const recommendations = [];
                  
                  // Health-based recommendations
                  if (plantStatus) {
                    if (plantStatus.status === 'diseased') {
                      recommendations.push({
                        type: 'critical',
                        message: 'Plant shows disease symptoms. Implement disease management immediately.',
                        action: 'disease_management'
                      });
                    }
                    if (plantStatus.status === 'pest-affected') {
                      recommendations.push({
                        type: 'warning',
                        message: 'Pest infestation detected. Apply appropriate pest control measures.',
                        action: 'pest_control'
                      });
                    }
                    if (plantStatus.soil_ph && (plantStatus.soil_ph < 5.5 || plantStatus.soil_ph > 6.5)) {
                      recommendations.push({
                        type: 'important',
                        message: `Soil pH (${plantStatus.soil_ph}) is outside optimal range (5.5-6.5). Consider pH adjustment.`,
                        action: 'ph_adjustment'
                      });
                    }
                    if (plantStatus.moisture_level === 'dry') {
                      recommendations.push({
                        type: 'important',
                        message: 'Soil moisture is low. Increase irrigation frequency.',
                        action: 'irrigation'
                      });
                    }
                  }
                  
                  // Quality-based recommendations
                  if (premiumGrade < 30) {
                    recommendations.push({
                      type: 'opportunity',
                      message: 'Premium grade production is low. Focus on cherry selection and processing.',
                      action: 'quality_improvement'
                    });
                  }
                  
                  if (avgYield < 2) {
                    recommendations.push({
                      type: 'opportunity',
                      message: 'Yield per tree is below optimal. Consider fertilization and pruning.',
                      action: 'yield_improvement'
                    });
                  }
                  
                  // Elevation-based recommendations
                  if (plant.elevation) {
                    if (plant.coffee_variety === 'Arabica' && plant.elevation < 900) {
                      recommendations.push({
                        type: 'warning',
                        message: 'Arabica requires 900-1,800 MASL. Consider variety change or shade management.',
                        action: 'variety_optimization'
                      });
                    }
                    if (plant.coffee_variety === 'Robusta' && plant.elevation > 1200) {
                      recommendations.push({
                        type: 'info',
                        message: 'Robusta optimal range is 600-1,200 MASL. Monitor for reduced yield.',
                        action: 'monitoring'
                      });
                    }
                  }
                  
                  // Default maintenance recommendation
                  if (recommendations.length === 0) {
                    recommendations.push({
                      type: 'maintenance',
                      message: 'Plant is performing well. Continue current maintenance practices.',
                      action: 'maintain'
                    });
                  }
                  
                  return recommendations;
                };
                
                const recommendations = getPlantRecommendations();
                
                return (
                  <div
                    key={plant.plant_id}
                    className={`p-4 rounded-lg shadow-md ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'} 
                      hover:shadow-lg transition-all duration-200 cursor-pointer border-l-4`}
                    style={{
                      borderLeftColor: plantStatus ? 
                        (plantStatus.status === 'healthy' ? '#10B981' : 
                         plantStatus.status === 'diseased' ? '#EF4444' : 
                         plantStatus.status === 'pest-affected' ? '#F59E0B' : '#6B7280') : '#6B7280'
                    }}
                    onClick={() => handlePlantClick(plant)}
                  >
                    {/* Plant Header */}
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {plant.coffee_variety}
                        </h3>
                        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          {plant.number_of_tree_planted} trees • {plant.elevation || 'N/A'} MASL
                        </p>
                      </div>
                      {plantStatus && (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(plantStatus.status)}`}>
                          {plantStatus.status}
                        </span>
                      )}
                    </div>
                    
                    {/* Quality Indicator */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          Quality Category
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${isDarkMode ? qualityCategory.darkBgColor : qualityCategory.bgColor} ${isDarkMode ? qualityCategory.darkColor : qualityCategory.color}`}>
                          {qualityCategory.category}
                        </span>
                      </div>
                      <div className="flex space-x-1">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-500 h-2 rounded-full" 
                            style={{ width: `${premiumGrade}%` }}
                          ></div>
                        </div>
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-500 h-2 rounded-full" 
                            style={{ width: `${fineGrade}%` }}
                          ></div>
                        </div>
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-amber-500 h-2 rounded-full" 
                            style={{ width: `${commercialGrade}%` }}
                          ></div>
                        </div>
                      </div>
                      <div className="flex justify-between text-xs mt-1">
                        <span className={isDarkMode ? 'text-green-400' : 'text-green-600'}>P: {premiumGrade.toFixed(1)}%</span>
                        <span className={isDarkMode ? 'text-blue-400' : 'text-blue-600'}>F: {fineGrade.toFixed(1)}%</span>
                        <span className={isDarkMode ? 'text-amber-400' : 'text-amber-600'}>C: {commercialGrade.toFixed(1)}%</span>
                      </div>
                    </div>
                    
                    {/* Performance Metrics */}
                    <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                      <div>
                        <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Avg Yield:</span>
                        <span className={`ml-1 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {avgYield.toFixed(1)} kg/tree
                        </span>
                      </div>
                      <div>
                        <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Harvests:</span>
                        <span className={`ml-1 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {plantHarvests.length}
                        </span>
                      </div>
                    </div>
                    
                    {/* Recommendations */}
                    <div className="space-y-2">
                      <h4 className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Recommendations
                      </h4>
                      {recommendations.slice(0, 2).map((rec, idx) => (
                        <div key={idx} className={`text-xs p-2 rounded ${isDarkMode ? 'bg-gray-600' : 'bg-gray-100'}`}>
                          <div className={`font-medium mb-1 ${
                            rec.type === 'critical' ? (isDarkMode ? 'text-red-400' : 'text-red-600') :
                            rec.type === 'warning' ? (isDarkMode ? 'text-yellow-400' : 'text-yellow-600') :
                            rec.type === 'important' ? (isDarkMode ? 'text-blue-400' : 'text-blue-600') :
                            rec.type === 'opportunity' ? (isDarkMode ? 'text-green-400' : 'text-green-600') :
                            (isDarkMode ? 'text-gray-300' : 'text-gray-600')
                          }`}>
                            {rec.type.charAt(0).toUpperCase() + rec.type.slice(1)}
                          </div>
                          <div className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
                            {rec.message}
                          </div>
                        </div>
                      ))}
                      {recommendations.length > 2 && (
                        <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          +{recommendations.length - 2} more recommendations
                        </div>
                      )}
                    </div>
                    
                    {/* Action Button */}
                    <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-600">
                      <button
                        className="w-full text-xs bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700 transition-colors duration-200"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/plant-status/${plant.plant_id}`);
                        }}
                      >
                        Update Status
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Predictive Analytics Summary Section */}
        <div className={`mb-8 p-6 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} hover:shadow-xl transition-shadow duration-200`}>
          <h2 className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Predictive Analytics</h2>
          <div className="mb-6">
            <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Summary:</span>
            <span className={`ml-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{getPredictiveAnalyticsSummary()}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {/* Projected Yield Card */}
            <div className={`p-4 rounded-lg shadow ${isDarkMode ? 'bg-indigo-900' : 'bg-indigo-50'}`}>
              <h3 className={`text-base font-bold mb-2 ${isDarkMode ? 'text-blue-300' : 'text-blue-700'}`}>Projected Next Harvest Yield</h3>
              <p className={`mt-2 text-2xl font-bold ${isDarkMode ? 'text-indigo-300' : 'text-indigo-800'}`}>{totalDryHarvests > 0 ? `${(totalDryHarvests * 1.1).toFixed(1)} kg` : 'N/A'}</p>
              <p className={`mt-1 text-xs ${isDarkMode ? 'text-indigo-100' : 'text-indigo-600'}`}>Estimated based on your recent dry harvests</p>
            </div>
            {/* Quality Distribution Card */}
            <div className={`p-4 rounded-lg shadow ${isDarkMode ? 'bg-green-900' : 'bg-green-50'}`}>
              <h3 className={`text-base font-bold mb-2 ${isDarkMode ? 'text-blue-300' : 'text-blue-700'}`}>Quality Distribution</h3>
              <ul className={`mt-2 text-base font-semibold ${isDarkMode ? 'text-blue-100' : 'text-blue-800'}`}>
                <li>Premium: {totalPremiumKg} kg</li>
                <li>Fine: {totalFineKg} kg</li>
                <li>Commercial: {totalCommercialKg} kg</li>
              </ul>
              <p className={`mt-1 text-xs ${isDarkMode ? 'text-blue-100' : 'text-blue-600'}`}>From your last harvests</p>
            </div>
            {/* Seasonal Forecast Card */}
            <div className={`p-4 rounded-lg shadow ${isDarkMode ? 'bg-amber-900' : 'bg-amber-50'}`}>
              <h3 className={`text-base font-bold mb-2 ${isDarkMode ? 'text-blue-300' : 'text-blue-700'}`}>Seasonal Yield Forecast</h3>
              <ul className={`mt-2 text-base font-semibold ${isDarkMode ? 'text-blue-100' : 'text-blue-800'}`}>
                <li>Peak: {(totalDryHarvests * 1.2).toFixed(1)} kg</li>
                <li>Mid: {(totalDryHarvests * 0.8).toFixed(1)} kg</li>
                <li>Off: {(totalDryHarvests * 0.4).toFixed(1)} kg</li>
              </ul>
              <p className={`mt-1 text-xs ${isDarkMode ? 'text-blue-100' : 'text-blue-600'}`}>Peak: Mar-May, Mid: Sep-Nov, Off: Other months</p>
            </div>
          </div>
          {/* Simple Recommendations */}
          <div className="mt-4">
            <h3 className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Quick Recommendations</h3>
            <ul className={`list-disc pl-6 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
              <li>Keep soil pH between 5.5 and 6.5 for best results.</li>
              <li>Water regularly, especially during dry or hot months.</li>
              <li>Watch for signs of disease or pests and act quickly.</li>
              <li>Apply fertilizer after each harvest for better yield.</li>
              <li>Check your plant health status for specific tips.</li>
            </ul>
          </div>
          <div className="flex justify-end mt-6">
            <button
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200"
              onClick={() => navigate('/predictive-analytics')}
            >
              See All Predictions
            </button>
          </div>
        </div>

        {/* DSS Recommendations Summary Section */}
        <div className={`mb-8 p-6 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} hover:shadow-xl transition-shadow duration-200`}>
          <h2 className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>DSS Recommendations</h2>
          <div className="mb-6">
            <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Summary:</span>
            <span className={`ml-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{getDssSummary()}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Yield/Quality/Farm Advice */}
            <div className={`p-4 rounded-lg shadow ${isDarkMode ? 'bg-green-900' : 'bg-green-50'}`}>
              <h3 className={`text-sm font-medium ${isDarkMode ? 'text-green-200' : 'text-green-700'}`}>Key Recommendations</h3>
              <ul className={`mt-2 text-base font-semibold ${isDarkMode ? 'text-green-100' : 'text-green-800'}`}>
                <li>Increase yield: Fertilize and prune regularly if yield per tree is low.</li>
                <li>Improve quality: Focus on cherry selection and better processing for more premium beans.</li>
                <li>Optimize land: Plant more trees if you have extra space.</li>
                <li>Harvest often: Schedule regular harvests for better quality and yield.</li>
                <li>Use shade: If your farm is at low elevation, provide shade for better quality.</li>
              </ul>
            </div>
            {/* Seasonal & Best Practices */}
            <div className={`p-4 rounded-lg shadow ${isDarkMode ? 'bg-blue-900' : 'bg-blue-50'}`}>
              <h3 className={`text-sm font-medium ${isDarkMode ? 'text-blue-200' : 'text-blue-700'}`}>Seasonal & Best Practices</h3>
              <ul className={`mt-2 text-base font-semibold ${isDarkMode ? 'text-blue-100' : 'text-blue-800'}`}>
                <li>Peak season: Harvest only ripe cherries and dry properly (Mar-May).</li>
                <li>Post-harvest: Prune, fertilize, and check for pests (Jun-Aug).</li>
                <li>Pre-harvest: Monitor cherry growth and prep equipment (Sep-Nov).</li>
                <li>Off-season: Focus on soil and water management (Dec-Feb).</li>
                <li>Always: Follow best practices for planting, maintenance, and harvesting.</li>
              </ul>
            </div>
          </div>
          <div className="flex justify-end mt-6">
            <button
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors duration-200"
              onClick={() => navigate('/dss-recommendations')}
            >
              See All Recommendations
            </button>
          </div>
        </div>

      </div>
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
                onClick={() => {
                  const iframe = document.getElementById('pdf-preview-iframe');
                  if (iframe && iframe.requestFullscreen) {
                    iframe.requestFullscreen();
                  } else if (iframe && iframe.webkitRequestFullscreen) {
                    iframe.webkitRequestFullscreen();
                  } else if (iframe && iframe.mozRequestFullScreen) {
                    iframe.mozRequestFullScreen();
                  } else if (iframe && iframe.msRequestFullscreen) {
                    iframe.msRequestFullscreen();
                  }
                }}
              >
                View in Fullscreen
              </button>
              <button
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200"
                onClick={() => {
                  setIsPdfPreviewOpen(false);
                  if (pdfUrl) URL.revokeObjectURL(pdfUrl);
                  setPdfUrl(null);
                  handleExportPDF(true);
                }}
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

export default FarmerDashboard;