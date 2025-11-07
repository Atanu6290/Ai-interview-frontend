import axiosInstance from "../utils/axiosInstance";


const generateQuestions = async (data) => {
  try {
    const response = await axiosInstance.post('/start-interview', data);
    return response.data;
    } catch (error) {
    console.error("Error creating JD Link:", error);
    throw error;


    }
};
export default generateQuestions;