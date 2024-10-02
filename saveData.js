const axios = require("axios");
const hubspot = require("@hubspot/api-client");

const updateTicketFees = async (accessToken, ticketId, fees) => {
  const URL = `https://api.hubapi.com/crm/v3/objects/ticket/${ticketId}`;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
  const body = {
    properties: {
      fees: fees,
    },
  };

  try {
    const response = await axios.patch(URL, body, { headers });
    console.log("Update fees response", response.data);
    return response.data;
  } catch (error) {
    throw error;
  }
};

const getTicketData = async (accessToken, ticketId) => {
  const URL = `https://api.hubapi.com/crm/v3/objects/ticket/${ticketId}?properties=building_type,cost_basis,property_placed_in_service_date,property_5yr_est,property_7yr_est,property_15yr_est,subject_property_address_1,subject_property_city,subject_property_state,subject_property_zip_code,property__bonus__year_applied,fees`;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  try {
    const response = await axios.get(URL, { headers });
    console.log("Get Ticket Data response", response.data);
    return response.data;
  } catch (error) {
    throw error;
  }
};

const getCalculatedProperties = async (GOOGLE_API_URL, buildingType, costBasis, monthAcquired, yearAcquired, yearApplied, year5, year7, year15, fees) => {
  console.log("GOOGLE_API_URL", GOOGLE_API_URL);
  let executeScriptURL = `${GOOGLE_API_URL}?buildingType=${buildingType}&costBasis=${costBasis}&monthAcquired=${monthAcquired}&yearAcquired=${yearAcquired}&yearApplied=${yearApplied}&year5=${year5}&year7=${year7}&year15=${year15}`;

  if (parseFloat(fees) > 0) {
    executeScriptURL += `&fees=${fees}`;
  }

  const { data } = await axios.get(executeScriptURL);
  if (!data.success) {
    throw `Error ${JSON.stringify(data)}`;
  }
  console.log("Get Calculated Properties from App Script Resp", data);

  return {
    depreciation: data.W25,
    taxImpactOnDepreciationDifference: data.X25,
    afterTaxStudyFee: data.AA15,
  };
};

const updateTicket = async (hubspotClient, tickets) => {
  for (const ticket of tickets) {
    const SimplePublicObjectInput = {
      properties: {
        projected_additional_depreciation: ticket.data.depreciation,
        tax_impact_on_depreciation_difference: ticket.data.taxImpactOnDepreciationDifference,
        after_tax_study_fee: ticket.data.afterTaxStudyFee,
      },
    };

    try {
      const apiResponse = await hubspotClient.crm.tickets.basicApi.update(ticket.id, SimplePublicObjectInput);
      console.log("Ticket updated successfully:", apiResponse);
    } catch (error) {
      // const errorMessage = error.response?.data?.message || error.message || "An unknown error occurred";
      // console.error("Error making post request", errorMessage);
      throw error;
    }
  }
};

const updateRelatedLineItem = async (hubspotClient, ticketsPropsAndData) => {
  for (const ticket of ticketsPropsAndData) {
    try {
      const response = await hubspotClient.crm.lineItems.searchApi.doSearch({
        filterGroups: [
          {
            filters: [
              {
                propertyName: "related_ticket_id",
                operator: "EQ",
                value: ticket.id,
              },
            ],
          },
        ],
      });

      console.log("Search related line item response", response);
      const lineItemId = response.results[0].id;

      const SimplePublicObjectInput = {
        properties: {
          projected_additional_depreciation: ticket.data.depreciation,
          tax_impact_on_depreciation_difference: ticket.data.taxImpactOnDepreciationDifference,
          after_tax_study_fee: ticket.data.afterTaxStudyFee,
        },
      };

      const apiResponse = await hubspotClient.crm.lineItems.basicApi.update(lineItemId, SimplePublicObjectInput);
      console.log("Update line item response", apiResponse);
    } catch (error) {
      throw error;
    }
  }
};

exports.saveData = async (GOOGLE_API_URL, accessToken, ticketId, fees) => {
  const ticketsPropsAndData = [];
  const hubspotClient = new hubspot.Client({ accessToken: accessToken });

  try {
    await updateTicketFees(accessToken, ticketId, fees);

    const ticketData = await getTicketData(accessToken, ticketId);

    const placedDate = new Date(ticketData.properties.property_placed_in_service_date);

    const data = await getCalculatedProperties(
      GOOGLE_API_URL,
      ticketData.properties.building_type,
      ticketData.properties.cost_basis,
      placedDate.getMonth() + 1,
      placedDate.getFullYear(),
      ticketData.properties.property__bonus__year_applied,
      ticketData.properties.property_5yr_est,
      ticketData.properties.property_7yr_est,
      ticketData.properties.property_15yr_est,
      ticketData.properties.fees
    );
    ticketsPropsAndData.push({ id: ticketData.id, data });
  } catch (error) {
    throw error;
  }

  // console.log("ticketPropsAndData", ticketsPropsAndData);

  if (ticketsPropsAndData.length > 0) {
    try {
      await updateTicket(hubspotClient, ticketsPropsAndData);
      await updateRelatedLineItem(hubspotClient, ticketsPropsAndData);
    } catch (error) {
      throw error;
    }
  }
};
