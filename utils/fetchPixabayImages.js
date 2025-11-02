const axios = require("axios");

async function fetchPixabayImages(query, limit = 4) {
  try {
    const response = await axios.get("https://pixabay.com/api/", {
      params: {
        key: process.env.PIXABAY_API_KEY,
        q: query,
        image_type: "photo",
        per_page: limit,
        safesearch: true,
      },
    });

    const hits = response.data.hits || [];
    return hits.map((img) => img.webformatURL); 
  } catch (err) {
    console.error("❌ Error fetching Pixabay images:", err.message);
    return [];
  }
}

module.exports = fetchPixabayImages;
