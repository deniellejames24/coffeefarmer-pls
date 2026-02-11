import React, { useEffect, useState } from "react";
import axios from "axios";

const PredictResult = ({ inputData, role }) => {
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPrediction = async () => {
      try {
        const response = await axios.get("http://127.0.0.1:48441/predict", {
          params: inputData,
        });
        setResult(response.data);
      } catch (err) {
        setError("Failed to fetch prediction.");
      }
    };

    if (inputData) fetchPrediction();
  }, [inputData]);

  if (error) return <p>{error}</p>;
  if (!result) return <p>Loading prediction...</p>;

  return (
    <div className="p-4 bg-white shadow rounded-xl">
      <h2 className="text-xl font-semibold">Predicted Coffee Grade</h2>
      <p className="text-2xl text-green-700 font-bold my-2">
        {result.predicted_grade}
      </p>

      {role === "admin" && result.confidence_chart && (
        <div className="mt-4">
          <h3 className="font-medium">Confidence Chart</h3>
          <img
            src={result.confidence_chart}
            alt="Confidence Chart"
            className="w-full max-w-md mt-2 rounded border"
          />
        </div>
      )}
    </div>
  );
};

export default PredictResult; 