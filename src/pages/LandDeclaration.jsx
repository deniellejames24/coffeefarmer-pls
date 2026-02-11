import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useTheme } from "../lib/ThemeContext";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Layout from '../components/Layout';
import { useAuth } from "../lib/AuthProvider";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import VerificationStatus from '../components/VerificationStatus';

const LandDeclaration = () => {
  const navigate = useNavigate();
  const { isDarkMode, toggleTheme } = useTheme();
  const { user: authUser } = useAuth();
  const initialLoadDone = useRef(false);
  const [farmerDetails, setFarmerDetails] = useState({
    farm_location: "",
    farm_size: "",
    farm_elevation: "", // This will now be calculated as a range
    verification_status: "draft",
    admin_notes: "",
    submitted_at: null,
    verified_at: null,
    verified_by: null,
  });
  const [plantDataList, setPlantDataList] = useState([]); // Array to hold multiple plant entries
  const [plantInputForm, setPlantInputForm] = useState({ // State for the single plant input form
    plant_id: null, // Will be null for new plants, set for editing
    coffee_variety: "",
    planting_date: "",
    number_of_tree_planted: "",
    elevation: "", // New field for individual plant elevation
    cluster_size: "", // New field for cluster size in square meters
    verification_status: "draft",
    admin_notes: "",
    submitted_at: null,
    verified_at: null,
    verified_by: null,
  });
  const [hasFarmerDetail, setHasFarmerDetail] = useState(false);
  const [isEditingFarmerDetail, setIsEditingFarmerDetail] = useState(false);
  const [isEditingPlant, setIsEditingPlant] = useState(false); // New state to manage editing an individual plant
  const [showPlantForm, setShowPlantForm] = useState(false); // Controls visibility of the plant data input form
  const exportRef = useRef();
  const [plantStatuses, setPlantStatuses] = useState({}); // plant_id -> status object

  // PDF preview modal state
  const [isPdfPreviewOpen, setIsPdfPreviewOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const pdfDocRef = useRef(null);

  // Function to calculate farm elevation range from plant elevations
  const calculateFarmElevationRange = (plants) => {
    if (!plants || plants.length === 0) return "";
    
    const elevations = plants
      .map(plant => parseFloat(plant.elevation))
      .filter(elevation => !isNaN(elevation));
    
    if (elevations.length === 0) return "";
    
    const minElevation = Math.min(...elevations);
    const maxElevation = Math.max(...elevations);
    
    return minElevation === maxElevation 
      ? `${minElevation} meters` 
      : `${minElevation}-${maxElevation} meters`;
  };

  const fetchFarmerAndPlantData = async () => {
    if (!authUser) {
      navigate("/login");
      return;
    }

    try {
      // Fetch farmer details
      const { data: farmerData, error: farmerError } = await supabase
        .from("farmer_detail")
        .select("*")
        .eq("id", authUser.id)
        .single();

      if (farmerError && farmerError.code === 'PGRST116') {
        setHasFarmerDetail(false);
        setIsEditingFarmerDetail(true);
        if (!initialLoadDone.current) {
          toast.info("No farmer details found. Please declare your farm.");
        }
      } else if (farmerData) {
        setFarmerDetails(farmerData);
        setHasFarmerDetail(true);
        setIsEditingFarmerDetail(false);

        // Fetch plant data
        const { data: plantDataFetched, error: plantListError } = await supabase
          .from("plant_data")
          .select("*")
          .eq("farmer_id", farmerData.id);

        if (!plantListError) {
          setPlantDataList(plantDataFetched || []);
          setShowPlantForm(false);
          if (!initialLoadDone.current) {
            const plantCount = plantDataFetched?.length || 0;
            if (plantCount > 0) {
              toast.success(`Farmer details and ${plantCount} plant cluster${plantCount > 1 ? 's' : ''} loaded successfully.`);
            } else {
              toast.success("Farmer details loaded. No plant clusters found.");
            }
          }
        } else {
          console.error("Error fetching plant data list:", plantListError);
          if (!initialLoadDone.current) {
            toast.error("Error loading data. Please try refreshing the page.");
          }
          setPlantDataList([]);
        }
      } else if (farmerError) {
        console.error("Error fetching farmer details:", farmerError);
        if (!initialLoadDone.current) {
          toast.error("Error loading data. Please try refreshing the page.");
        }
      }
    } catch (error) {
      console.error("Error in fetchFarmerAndPlantData:", error);
      if (!initialLoadDone.current) {
        toast.error("An unexpected error occurred.");
      }
    } finally {
      initialLoadDone.current = true;
    }
  };

  useEffect(() => {
    fetchFarmerAndPlantData();
  }, [authUser, navigate]);

  // Fetch latest status for each plant after plantDataList is loaded
  useEffect(() => {
    const fetchStatuses = async () => {
      if (!plantDataList || plantDataList.length === 0) {
        setPlantStatuses({});
        return;
      }
      const statuses = {};
      for (const plant of plantDataList) {
        const { data, error } = await supabase
          .from('plant_status')
          .select('*')
          .eq('plant_id', plant.plant_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        if (!error && data) {
          statuses[plant.plant_id] = data;
        }
      }
      setPlantStatuses(statuses);
    };
    fetchStatuses();
  }, [plantDataList]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const handleFarmerDetailChange = (e) => {
    const { name, value } = e.target;
    setFarmerDetails((prev) => ({ ...prev, [name]: value }));
  };

  const handlePlantInputChange = (e) => {
    const { name, value } = e.target;
    setPlantInputForm((prev) => ({ ...prev, [name]: value }));
  };

  const saveFarmerDetails = async () => {
    if (!authUser) {
      toast.error("User not authenticated.");
      return;
    }

    if (!farmerDetails.farm_location || farmerDetails.farm_size === "") {
      toast.warning("Please fill farm location and farm size fields.");
      return;
    }
    const parsedFarmSize = parseFloat(farmerDetails.farm_size);

    if (isNaN(parsedFarmSize) || parsedFarmSize < 0) {
      toast.warning("Farm size must be a valid positive number.");
      return;
    }

    // Calculate farm elevation range from existing plants
    const elevationRange = calculateFarmElevationRange(plantDataList);

    // Fetch old farm details for activity log
    let oldFarmDetails = null;
    try {
      const { data: oldData } = await supabase
        .from("farmer_detail")
        .select("*")
        .eq("id", authUser.id)
        .single();
      if (oldData) oldFarmDetails = oldData;
    } catch (e) { /* ignore */ }

    try {
      const { data, error } = await supabase
        .from("farmer_detail")
        .upsert(
          {
            id: authUser.id, // Link to authenticated user's UUID
            farm_location: farmerDetails.farm_location,
            farm_size: parsedFarmSize,
            farm_elevation: elevationRange || "Not specified", // Use calculated range or default text
            verification_status: "pending",
            submitted_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        )
        .select()
        .single();

      if (error) {
        throw error;
      }

      setFarmerDetails(data);
      setHasFarmerDetail(true);
      setIsEditingFarmerDetail(false);
      toast.success("Farmer details saved successfully!");

      // Log activity if this was an update (not first insert) and if any value changed
      if (oldFarmDetails) {
        // Determine which fields changed
        const changedFields = [];
        if (oldFarmDetails.farm_location !== data.farm_location) changedFields.push('Farm Location');
        if (Number(oldFarmDetails.farm_size) !== Number(data.farm_size)) changedFields.push('Farm Size');
        if (oldFarmDetails.farm_elevation !== data.farm_elevation) changedFields.push('Elevation Range');
        if (changedFields.length > 0) {
          // Prepare old/new data with only changed fields
          const oldChanged = {};
          const newChanged = {};
          if (changedFields.includes('Farm Location')) {
            oldChanged.farm_location = oldFarmDetails.farm_location;
            newChanged.farm_location = data.farm_location;
          }
          if (changedFields.includes('Farm Size')) {
            oldChanged.farm_size = oldFarmDetails.farm_size;
            newChanged.farm_size = data.farm_size;
          }
          if (changedFields.includes('Elevation Range')) {
            oldChanged.farm_elevation = oldFarmDetails.farm_elevation;
            newChanged.farm_elevation = data.farm_elevation;
          }
          try {
            const logRes = await supabase.from("activity_log").insert({
              user_id: authUser.id,
              farmer_id: data.id,
              entity_type: "Farm Details",
              entity_id: null,
              action: "update",
              change_summary: `Changed ${changedFields.join(', ')} in Farm Details`,
              old_data: JSON.stringify(oldChanged),
              new_data: JSON.stringify(newChanged)
            });
            if (logRes.error) {
              console.error("Failed to insert activity log for farm detail update:", logRes.error);
              toast.error("Failed to record activity log for farm detail update.");
            } else {
              console.log("Activity log recorded for farm detail update.");
            }
          } catch (logErr) {
            console.error("Error inserting activity log for farm detail update:", logErr);
            toast.error("Error recording activity log for farm detail update.");
          }
        } else {
          console.log("No actual change in farm details, so no activity log recorded.");
        }
      }
    } catch (error) {
      console.error("Error saving farmer details:", error);
      toast.error(`Error saving farmer details: ${error.message}`);
    }
  };

  const savePlantData = async (e) => {
    e.preventDefault(); // Prevent default form submission
    if (!authUser || !hasFarmerDetail || !farmerDetails.id) {
      toast.error("Farmer details not saved or user not authenticated.");
      return;
    }

    if (!plantInputForm.coffee_variety || !plantInputForm.planting_date || 
        plantInputForm.number_of_tree_planted === "" || 
        plantInputForm.elevation === "" || 
        plantInputForm.cluster_size === "") {
      toast.warning("Please fill all plant cluster data fields.");
      return;
    }
    
    const parsedNumTrees = parseInt(plantInputForm.number_of_tree_planted, 10);
    const parsedElevation = parseFloat(plantInputForm.elevation);
    const parsedClusterSize = parseFloat(plantInputForm.cluster_size);
    
    if (isNaN(parsedNumTrees) || parsedNumTrees <= 0) {
      toast.warning("Number of trees planted must be a positive whole number.");
      return;
    }
    
    if (isNaN(parsedElevation) || parsedElevation < 0) {
      toast.warning("Elevation must be a valid positive number.");
      return;
    }
    
    if (isNaN(parsedClusterSize) || parsedClusterSize <= 0) {
      toast.warning("Cluster size must be a valid positive number.");
      return;
    }

    try {
      if (plantInputForm.plant_id) {
        // Update existing plant_data
        // Fetch old data for logging
        const { data: oldPlant } = await supabase
          .from("plant_data")
          .select("*")
          .eq("plant_id", plantInputForm.plant_id)
          .single();
        const { error: updateError } = await supabase
          .from("plant_data")
          .update({
            coffee_variety: plantInputForm.coffee_variety,
            planting_date: plantInputForm.planting_date,
            number_of_tree_planted: parsedNumTrees,
            elevation: parsedElevation,
            cluster_size: parsedClusterSize,
          })
          .eq("plant_id", plantInputForm.plant_id);
        if (updateError) throw updateError;
        // Log update
        await supabase.from("activity_log").insert({
          user_id: authUser.id,
          farmer_id: farmerDetails.id,
          entity_type: "plant",
          entity_id: plantInputForm.plant_id,
          action: "update",
          change_summary: `Updated plant cluster (${plantInputForm.coffee_variety})`,
          old_data: JSON.stringify(oldPlant),
          new_data: JSON.stringify({ ...oldPlant, coffee_variety: plantInputForm.coffee_variety, planting_date: plantInputForm.planting_date, number_of_tree_planted: parsedNumTrees, elevation: parsedElevation, cluster_size: parsedClusterSize })
        });
        toast.success("Plant cluster data updated successfully!");
      } else {
        // Insert new plant_data
        const { data: newPlant, error: insertError } = await supabase
          .from("plant_data")
          .insert({
            farmer_id: farmerDetails.id,
            coffee_variety: plantInputForm.coffee_variety,
            planting_date: plantInputForm.planting_date,
            number_of_tree_planted: parsedNumTrees,
            elevation: parsedElevation,
            cluster_size: parsedClusterSize,
            verification_status: "pending",
            submitted_at: new Date().toISOString(),
          })
          .select("*")
          .single();
        if (insertError) throw insertError;
        // Log create
        await supabase.from("activity_log").insert({
          user_id: authUser.id,
          farmer_id: farmerDetails.id,
          entity_type: "plant",
          entity_id: newPlant.plant_id,
          action: "create",
          change_summary: `Created plant cluster (${plantInputForm.coffee_variety})`,
          old_data: null,
          new_data: JSON.stringify(newPlant)
        });
        toast.success("Plant cluster data added successfully!");
      }

      // Re-fetch all plant data to update the list
      const { data: updatedPlantList, error: fetchError } = await supabase
        .from("plant_data")
        .select("*")
        .eq("farmer_id", farmerDetails.id);

      if (fetchError) throw fetchError;
      setPlantDataList(updatedPlantList || []);

      // Update farm elevation range after plant changes
      const newElevationRange = calculateFarmElevationRange(updatedPlantList || []);
      if (newElevationRange !== farmerDetails.farm_elevation) {
        const { error: updateFarmError } = await supabase
          .from("farmer_detail")
          .update({ farm_elevation: newElevationRange })
          .eq("id", farmerDetails.id);
        if (!updateFarmError) {
          setFarmerDetails(prev => ({ ...prev, farm_elevation: newElevationRange }));
        }
      }

      // Reset form and hide it after successful save/update
      setPlantInputForm({
        plant_id: null,
        coffee_variety: "",
        planting_date: "",
        number_of_tree_planted: "",
        elevation: "",
        cluster_size: "",
        verification_status: "draft",
        admin_notes: "",
        submitted_at: null,
        verified_at: null,
        verified_by: null,
      });
      setShowPlantForm(false);
      setIsEditingPlant(false); // Exit editing mode for plant
    } catch (error) {
      console.error("Error saving plant data:", error);
      toast.error(`Error saving plant data: ${error.message}`);
    }
  };

  const editPlant = (plant) => {
    setPlantInputForm({
      plant_id: plant.plant_id,
      coffee_variety: plant.coffee_variety,
      planting_date: plant.planting_date.split('T')[0], // Format for date input
      number_of_tree_planted: plant.number_of_tree_planted,
      elevation: plant.elevation || "",
      cluster_size: plant.cluster_size || "",
      verification_status: plant.verification_status || "draft",
      admin_notes: plant.admin_notes || "",
      submitted_at: plant.submitted_at || null,
      verified_at: plant.verified_at || null,
      verified_by: plant.verified_by || null,
    });
    setShowPlantForm(true);
    setIsEditingPlant(true);
  };

  const deletePlant = async (plantId) => {
    if (!window.confirm("Are you sure you want to delete this plant cluster entry?")) return;
    // Fetch old data for logging
    const plantToDelete = plantDataList.find(plant => plant.plant_id === plantId);
    try {
      const { error } = await supabase
        .from("plant_data")
        .delete()
        .eq("plant_id", plantId);
      if (error) throw error;
      // Log delete
      await supabase.from("activity_log").insert({
        user_id: authUser.id,
        farmer_id: farmerDetails.id,
        entity_type: "plant",
        entity_id: plantId,
        action: "delete",
        change_summary: `Deleted plant cluster (${plantToDelete?.coffee_variety || 'Unknown'})`,
        old_data: JSON.stringify(plantToDelete),
        new_data: null
      });
      toast.success("Plant cluster data deleted successfully!");
      
      const updatedPlantList = plantDataList.filter(plant => plant.plant_id !== plantId);
      setPlantDataList(updatedPlantList);

      // Update farm elevation range after deletion
      const newElevationRange = calculateFarmElevationRange(updatedPlantList);
      if (newElevationRange !== farmerDetails.farm_elevation) {
        const { error: updateFarmError } = await supabase
          .from("farmer_detail")
          .update({ farm_elevation: newElevationRange })
          .eq("id", farmerDetails.id);
        if (!updateFarmError) {
          setFarmerDetails(prev => ({ ...prev, farm_elevation: newElevationRange }));
        }
      }

      // If the deleted plant was being edited, reset the form
      if (plantInputForm.plant_id === plantId) {
        setPlantInputForm({ 
          plant_id: null, 
          coffee_variety: "", 
          planting_date: "", 
          number_of_tree_planted: "", 
          elevation: "", 
          cluster_size: "",
          verification_status: "draft",
          admin_notes: "",
          submitted_at: null,
          verified_at: null,
          verified_by: null,
        });
        setShowPlantForm(false);
        setIsEditingPlant(false);
      }
    } catch (error) {
      console.error("Error deleting plant data:", error);
      toast.error(`Error deleting plant data: ${error.message}`);
    }
  };

  const cancelPlantEdit = () => {
    setPlantInputForm({ 
      plant_id: null, 
      coffee_variety: "", 
      planting_date: "", 
      number_of_tree_planted: "", 
      elevation: "", 
      cluster_size: "",
      verification_status: "draft",
      admin_notes: "",
      submitted_at: null,
      verified_at: null,
      verified_by: null,
    });
    setShowPlantForm(false);
    setIsEditingPlant(false);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();

    // Title
    doc.setFontSize(18);
    doc.text('Land & Plant Declaration', 14, 18);

    // Date
    doc.setFontSize(10);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 26);

    // Farmer Name
    doc.setFontSize(12);
    let farmerName = authUser?.fullName || (authUser?.first_name ? `${authUser.first_name} ${authUser.last_name || ''}` : '');
    if (!farmerName && farmerDetails.first_name) {
      farmerName = `${farmerDetails.first_name} ${farmerDetails.last_name || ''}`;
    }
    farmerName = farmerName.trim() || '-';
    doc.text(`Farmer: ${farmerName}`, 14, 34);

    // Farm Details Section
    doc.setFontSize(14);
    doc.text('Farm Details', 14, 44);
    doc.setLineWidth(0.5);
    doc.line(14, 46, 196, 46); // divider
    doc.setFontSize(11);
    doc.text('Location:', 14, 54);
    doc.text(farmerDetails.farm_location || '-', 50, 54);
    doc.text('Size (hectares):', 14, 62);
    doc.text(farmerDetails.farm_size ? String(farmerDetails.farm_size) : '-', 50, 62);
    doc.text('Elevation (meters):', 14, 70);
    doc.text(farmerDetails.farm_elevation || '-', 50, 70);

    // Plant Data Table
    let nextY = 78;
    doc.setFontSize(14);
    doc.text('Coffee Plants', 14, nextY);
    doc.setLineWidth(0.5);
    doc.line(14, nextY + 2, 196, nextY + 2); // divider
    nextY += 8;
    if (plantDataList.length > 0) {
      autoTable(doc, {
        startY: nextY,
        head: [['Cluster ID', 'Variety', 'Planting Date', 'Number of Trees', 'Elevation (m)', 'Cluster Size (sqm)', 'Status']],
        body: plantDataList.map((plant, index) => [
          index + 1,
          plant.coffee_variety,
          plant.planting_date ? new Date(plant.planting_date).toLocaleDateString() : '',
          plant.number_of_tree_planted,
          plant.elevation || '-',
          plant.cluster_size || '-',
          plantStatuses[plant.plant_id]?.status || 'No status'
        ]),
        theme: 'grid',
        headStyles: { fillColor: [34, 197, 94] },
        styles: { fontSize: 11 },
      });
      nextY = doc.lastAutoTable.finalY + 8;
      // Plant Status Table
      doc.setFontSize(14);
      doc.text('Plant Status', 14, nextY);
      doc.setLineWidth(0.5);
      doc.line(14, nextY + 2, 196, nextY + 2); // divider
      nextY += 8;
      autoTable(doc, {
        startY: nextY,
        head: [['Cluster ID', 'Variety', 'Status', 'Age Stage', 'Soil pH', 'Moisture', 'Last Fertilized']],
        body: plantDataList.map((plant, index) => {
          const status = plantStatuses[plant.plant_id] || {};
          return [
            index + 1,
            plant.coffee_variety,
            status.status || '-',
            status.age_stage || '-',
            status.soil_ph !== undefined && status.soil_ph !== null ? status.soil_ph : '-',
            status.moisture_level || '-',
            status.last_fertilized ? new Date(status.last_fertilized).toLocaleDateString() : '-'
          ];
        }),
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] },
        styles: { fontSize: 11 },
      });
    } else {
      doc.setFontSize(11);
      doc.text('No plant records found.', 14, nextY + 6);
    }

    // Save the PDF with farmer name in filename
    const safeName = farmerName.replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(`Land_Plant_Declaration_${safeName}.pdf`);
  };

  const handleExportWithPreview = (download = false) => {
    const doc = new jsPDF();
    pdfDocRef.current = doc;

    // Title
    doc.setFontSize(18);
    doc.text('Land & Plant Declaration', 14, 18);

    // Date
    doc.setFontSize(10);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 26);

    // Farmer Name
    doc.setFontSize(12);
    let farmerName = authUser?.fullName || (authUser?.first_name ? `${authUser.first_name} ${authUser.last_name || ''}` : '');
    if (!farmerName && farmerDetails.first_name) {
      farmerName = `${farmerDetails.first_name} ${farmerDetails.last_name || ''}`;
    }
    farmerName = farmerName.trim() || '-';
    doc.text(`Farmer: ${farmerName}`, 14, 34);

    // Farm Details Section
    doc.setFontSize(14);
    doc.text('Farm Details', 14, 44);
    doc.setLineWidth(0.5);
    doc.line(14, 46, 196, 46); // divider
    doc.setFontSize(11);
    doc.text('Location:', 14, 54);
    doc.text(farmerDetails.farm_location || '-', 50, 54);
    doc.text('Size (hectares):', 14, 62);
    doc.text(farmerDetails.farm_size ? String(farmerDetails.farm_size) : '-', 50, 62);
    doc.text('Elevation (meters):', 14, 70);
    doc.text(farmerDetails.farm_elevation || '-', 50, 70);

    // Plant Data Table
    let nextY = 78;
    doc.setFontSize(14);
    doc.text('Coffee Plants', 14, nextY);
    doc.setLineWidth(0.5);
    doc.line(14, nextY + 2, 196, nextY + 2); // divider
    nextY += 8;
    if (plantDataList.length > 0) {
      autoTable(doc, {
        startY: nextY,
        head: [['Cluster ID', 'Variety', 'Planting Date', 'Number of Trees', 'Elevation (m)', 'Cluster Size (sqm)', 'Status']],
        body: plantDataList.map((plant, index) => [
          index + 1,
          plant.coffee_variety,
          plant.planting_date ? new Date(plant.planting_date).toLocaleDateString() : '',
          plant.number_of_tree_planted,
          plant.elevation || '-',
          plant.cluster_size || '-',
          plantStatuses[plant.plant_id]?.status || 'No status'
        ]),
        theme: 'grid',
        headStyles: { fillColor: [34, 197, 94] },
        styles: { fontSize: 11 },
      });
      nextY = doc.lastAutoTable.finalY + 8;
      // Plant Status Table
      doc.setFontSize(14);
      doc.text('Plant Status', 14, nextY);
      doc.setLineWidth(0.5);
      doc.line(14, nextY + 2, 196, nextY + 2); // divider
      nextY += 8;
      autoTable(doc, {
        startY: nextY,
        head: [['Cluster ID', 'Variety', 'Status', 'Age Stage', 'Soil pH', 'Moisture', 'Last Fertilized']],
        body: plantDataList.map((plant, index) => {
          const status = plantStatuses[plant.plant_id] || {};
          return [
            index + 1,
            plant.coffee_variety,
            status.status || '-',
            status.age_stage || '-',
            status.soil_ph !== undefined && status.soil_ph !== null ? status.soil_ph : '-',
            status.moisture_level || '-',
            status.last_fertilized ? new Date(status.last_fertilized).toLocaleDateString() : '-'
          ];
        }),
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] },
        styles: { fontSize: 11 },
      });
    } else {
      doc.setFontSize(11);
      doc.text('No plant records found.', 14, nextY + 6);
    }

    // Show preview or download
    if (download) {
        const farmerName = (authUser?.fullName || (authUser?.first_name ? `${authUser.first_name} ${authUser.last_name || ''}` : '')).replace(/[^a-zA-Z0-9]/g, '_');
        doc.save(`Land_Plant_Declaration_${farmerName}.pdf`);
    } else {
        const blob = doc.output('blob');
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
        setIsPdfPreviewOpen(true);
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

  const navLinks = authUser?.role === "admin" ? adminLinks : userLinks;

  return (
    <Layout>
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* Main Exportable Content */}
          <div ref={exportRef}>
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
                  <h2 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Land & Plant Declaration</h2>
                </div>
                <button
                  onClick={() => handleExportWithPreview(false)}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors duration-200"
                >
                  Export to PDF
                </button>
              </div>
              <p className={`mt-2 text-lg ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Manage your farm details and coffee plant information</p>
            </div>

            {/* Farm Details Section */}
            <div className={`mb-8 p-6 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} hover:shadow-xl transition-shadow duration-200`}>
              <div className="flex items-center justify-between mb-6">
                <h3 className={`text-xl font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Farm Details</h3>
                <div className="flex items-center space-x-4">
                  <div className={`p-3 rounded-full ${isDarkMode ? 'bg-green-900' : 'bg-green-100'}`}>
                    <svg className={`w-6 h-6 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                  </div>
                  {!isEditingFarmerDetail && (
                    <button
                      onClick={() => setIsEditingFarmerDetail(true)}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        isDarkMode
                          ? 'bg-green-600 hover:bg-green-700 text-white'
                          : 'bg-green-600 hover:bg-green-700 text-white'
                      }`}
                    >
                      Edit Farm Details
                    </button>
                  )}
                </div>
              </div>

              {/* Verification Status */}
              {hasFarmerDetail && (
                <div className="mb-4">
                  <VerificationStatus
                    status={farmerDetails.verification_status || 'draft'}
                    adminNotes={farmerDetails.admin_notes}
                    submittedAt={farmerDetails.submitted_at}
                    verifiedAt={farmerDetails.verified_at}
                    verifiedBy={farmerDetails.verified_by}
                  />
                </div>
              )}

              {isEditingFarmerDetail ? (
                <form onSubmit={(e) => { e.preventDefault(); saveFarmerDetails(); }} className="space-y-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Farm Location
                    </label>
                    <input
                      type="text"
                      name="farm_location"
                      value={farmerDetails.farm_location}
                      onChange={handleFarmerDetailChange}
                      className={`w-full px-3 py-2 rounded-lg border ${
                        isDarkMode
                          ? 'bg-gray-700 border-gray-600 text-white focus:border-green-500'
                          : 'bg-white border-gray-300 text-gray-900 focus:border-green-500'
                      } focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition-colors`}
                      required
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Farm Size (hectares)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      name="farm_size"
                      value={farmerDetails.farm_size}
                      onChange={handleFarmerDetailChange}
                      className={`w-full px-3 py-2 rounded-lg border ${
                        isDarkMode
                          ? 'bg-gray-700 border-gray-600 text-white focus:border-green-500'
                          : 'bg-white border-gray-300 text-gray-900 focus:border-green-500'
                      } focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition-colors`}
                      required
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Farm Elevation Range (calculated from plant clusters)
                    </label>
                    <input
                      type="text"
                      name="farm_elevation"
                      value={farmerDetails.farm_elevation}
                      onChange={handleFarmerDetailChange}
                      className={`w-full px-3 py-2 rounded-lg border ${
                        isDarkMode
                          ? 'bg-gray-700 border-gray-600 text-white focus:border-green-500'
                          : 'bg-white border-gray-300 text-gray-900 focus:border-green-500'
                      } focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition-colors`}
                      placeholder="e.g., 1100-1500 meters"
                      readOnly
                    />
                    <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      This is automatically calculated from your plant cluster elevations
                    </p>
                  </div>

                  <div className="flex space-x-4">
                    <button
                      type="submit"
                      className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        isDarkMode
                          ? 'bg-green-600 hover:bg-green-700 text-white'
                          : 'bg-green-600 hover:bg-green-700 text-white'
                      }`}
                    >
                      Save Farm Details
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingFarmerDetail(false)}
                      className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        isDarkMode
                          ? 'bg-gray-600 hover:bg-gray-700 text-white'
                          : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                      }`}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Farm Location</p>
                    <p className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {farmerDetails.farm_location}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Farm Size</p>
                    <p className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {farmerDetails.farm_size} hectares
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Farm Elevation</p>
                    <p className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {farmerDetails.farm_elevation}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Plant Data Section */}
            <div className={`p-6 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} hover:shadow-xl transition-shadow duration-200`}>
              <div className="flex items-center justify-between mb-6">
                <h3 className={`text-xl font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Coffee Plant Clusters</h3>
                <div className="flex items-center space-x-4">
                  <div className={`p-3 rounded-full ${isDarkMode ? 'bg-indigo-900' : 'bg-indigo-100'}`}>
                    <svg className={`w-6 h-6 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <button
                    onClick={() => setShowPlantForm(true)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      isDarkMode
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                  >
                    Add New Plant Cluster
                  </button>
                </div>
              </div>

              {showPlantForm && (
                <form onSubmit={savePlantData} className="mb-8 space-y-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Coffee Variety
                    </label>
                    <select
                      name="coffee_variety"
                      value={plantInputForm.coffee_variety}
                      onChange={handlePlantInputChange}
                      className={`w-full px-3 py-2 rounded-lg border ${
                        isDarkMode
                          ? 'bg-gray-700 border-gray-600 text-white focus:border-indigo-500'
                          : 'bg-white border-gray-300 text-gray-900 focus:border-indigo-500'
                      } focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 transition-colors`}
                      required
                    >
                      <option value="" disabled>Select variety</option>
                      <option value="Robusta">Robusta</option>
                      <option value="Arabica">Arabica</option>
                    </select>
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Planting Date
                    </label>
                    <input
                      type="date"
                      name="planting_date"
                      value={plantInputForm.planting_date}
                      onChange={handlePlantInputChange}
                      className={`w-full px-3 py-2 rounded-lg border ${
                        isDarkMode
                          ? 'bg-gray-700 border-gray-600 text-white focus:border-indigo-500 date-input-dark'
                          : 'bg-white border-gray-300 text-gray-900 focus:border-indigo-500 date-input-light'
                      } focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 transition-colors`}
                      required
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Number of Trees Planted
                    </label>
                    <input
                      type="number"
                      name="number_of_tree_planted"
                      value={plantInputForm.number_of_tree_planted}
                      onChange={handlePlantInputChange}
                      className={`w-full px-3 py-2 rounded-lg border ${
                        isDarkMode
                          ? 'bg-gray-700 border-gray-600 text-white focus:border-indigo-500'
                          : 'bg-white border-gray-300 text-gray-900 focus:border-indigo-500'
                      } focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 transition-colors`}
                      required
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Elevation (meters)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      name="elevation"
                      value={plantInputForm.elevation}
                      onChange={handlePlantInputChange}
                      className={`w-full px-3 py-2 rounded-lg border ${
                        isDarkMode
                          ? 'bg-gray-700 border-gray-600 text-white focus:border-indigo-500'
                          : 'bg-white border-gray-300 text-gray-900 focus:border-indigo-500'
                      } focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 transition-colors`}
                      placeholder="e.g., 1100"
                      required
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Cluster Size (square meters)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      name="cluster_size"
                      value={plantInputForm.cluster_size}
                      onChange={handlePlantInputChange}
                      className={`w-full px-3 py-2 rounded-lg border ${
                        isDarkMode
                          ? 'bg-gray-700 border-gray-600 text-white focus:border-indigo-500'
                          : 'bg-white border-gray-300 text-gray-900 focus:border-indigo-500'
                      } focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 transition-colors`}
                      placeholder="e.g., 15000"
                      required
                    />
                  </div>



                  <div className="flex justify-end space-x-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowPlantForm(false);
                        setIsEditingPlant(false);
                        setPlantInputForm({
                          plant_id: null,
                          coffee_variety: "",
                          planting_date: "",
                          number_of_tree_planted: "",
                          elevation: "",
                          cluster_size: "",
                          verification_status: "draft",
                          admin_notes: "",
                          submitted_at: null,
                          verified_at: null,
                          verified_by: null,
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
                          ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      }`}
                    >
                      {isEditingPlant ? 'Update Plant Cluster' : 'Add Plant Cluster'}
                    </button>
                  </div>
                </form>
              )}

              {/* Tabular Plant List */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead>
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">Cluster ID</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">Variety</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">Planting Date</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">Number of Trees</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">Elevation (m)</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">Cluster Size (sqm)</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">Verification</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">Status</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plantDataList.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-6 text-gray-500 dark:text-gray-300">No plant cluster records found.</td>
                      </tr>
                    ) : (
                      plantDataList.map((plant, index) => (
                        <tr key={plant.plant_id} className={isDarkMode ? 'bg-gray-700' : 'bg-white'}>
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${
                              isDarkMode ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-800'
                            }`}>
                              {index + 1}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{plant.coffee_variety}</td>
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{new Date(plant.planting_date).toLocaleDateString()}</td>
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{plant.number_of_tree_planted}</td>
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{plant.elevation || '-'}</td>
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{plant.cluster_size || '-'}</td>
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium text-white ${
                              plant.verification_status === 'approved' ? 'bg-green-500' :
                              plant.verification_status === 'pending' ? 'bg-yellow-500' :
                              plant.verification_status === 'rejected' ? 'bg-red-500' :
                              'bg-gray-500'
                            }`}>
                              {plant.verification_status || 'draft'}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                            {plantStatuses[plant.plant_id] ? (
                              <button
                                onClick={() => navigate(`/plant-status/${plant.plant_id}`)}
                                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                                  plantStatuses[plant.plant_id].status === 'healthy'
                                    ? isDarkMode ? 'bg-green-900 text-green-200 hover:bg-green-800' : 'bg-green-100 text-green-800 hover:bg-green-200'
                                    : plantStatuses[plant.plant_id].status === 'diseased'
                                    ? isDarkMode ? 'bg-red-900 text-red-200 hover:bg-red-800' : 'bg-red-100 text-red-800 hover:bg-red-200'
                                    : plantStatuses[plant.plant_id].status === 'pest-affected'
                                    ? isDarkMode ? 'bg-yellow-900 text-yellow-200 hover:bg-yellow-800' : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                                    : isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                                }`}
                              >
                                {plantStatuses[plant.plant_id].status}
                              </button>
                            ) : (
                              <button
                                onClick={() => navigate(`/plant-status/${plant.plant_id}`)}
                                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer border-2 border-dashed ${
                                  isDarkMode 
                                    ? 'text-gray-400 border-gray-500 hover:bg-gray-700 hover:text-gray-200 hover:border-gray-400' 
                                    : 'text-gray-500 border-gray-400 hover:bg-gray-100 hover:text-gray-700 hover:border-gray-500'
                                }`}
                              >
                                Declare Status
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                            <div className="flex space-x-2">
                              <button
                                onClick={() => editPlant(plant)}
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
                                onClick={() => deletePlant(plant.plant_id)}
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
                      ))
                    )}
                  </tbody>
                </table>
              </div>
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
                            onClick={() => handleExportWithPreview(true)}
                        >
                            Download PDF
                        </button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </Layout>
  );
};

export default LandDeclaration;