import axiosInstance from "../utils/axiosInstance";


const createJDLink = async (data) => {
  try {
    const response = await axiosInstance.post('/create-jd-link', data);
    return response.data;
    } catch (error) {
    console.error("Error creating JD Link:", error);
    throw error;


    }
};
export default createJDLink;
