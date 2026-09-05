const formatApiResponse = (data, extra = {}) => ({
  success: true,
  data,
  ...extra,
});

module.exports = { formatApiResponse };
