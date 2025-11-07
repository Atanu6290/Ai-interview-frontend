import axiosInstance from "../utils/axiosInstance";

const getNextQuestion = async (data) => {
  try {
    const response = await axiosInstance.post('/next-question', data);
    return response.data;
  } catch (error) {
    console.error("Error fetching next question:", error);
    throw error;
  }
};

export default getNextQuestion;
