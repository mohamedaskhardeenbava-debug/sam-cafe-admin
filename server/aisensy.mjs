import axios from "axios";

const AISENSY_API_KEY = process.env.AISENSY_API_KEY;
const BASE_URL = "https://backend.aisensy.com/campaign/t1/api";

export const sendTemplate = async ({ phone, templateName, variables }) => {
  console.log("AISENSY KEY:", process.env.AISENSY_API_KEY);
  return axios.post(
    `${BASE_URL}/sendTemplateMessage`,
    {
      apiKey: AISENSY_API_KEY,
      campaignName: templateName,
      destination: phone,
      userName: "Sam Cafe",
      templateParams: variables
    },
    {
      headers: { "Content-Type": "application/json" }
    }
  );
};