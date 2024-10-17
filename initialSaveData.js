const axios = require("axios").default;
const hubspot = require("@hubspot/api-client");
let hubspotClient = null;
let googleApiUrl = null;

async function getDealsAssociatedTickets(dealID) {
  const response = await hubspotClient.crm.tickets.searchApi.doSearch({
    filterGroups: [
      {
        filters: [
          {
            propertyName: "associations.deal",
            operator: "EQ",
            value: dealID,
          },
        ],
      },
    ],
    after: "",
    limit: 50,
    properties: [
      "building_type",
      "cost_basis",
      "property_placed_in_service_date",
      "property_5yr_est",
      "property_7yr_est",
      "property_15yr_est",
      "subject_property_address_1",
      "subject_property_city",
      "subject_property_state",
      "subject_property_zip_code",
      "property__bonus__year_applied",
      "fees",
    ],
    sorts: [""],
  });
  return response;
}

const getCalculatedProperties = async (buildingType, costBasis, monthAcquired, yearAcquired, yearApplied, year5, year7, year15, fees) => {
  console.log("inside getCalc", googleApiUrl);
  let executeScriptURL = `${googleApiUrl}?buildingType=${buildingType}&costBasis=${costBasis}&monthAcquired=${monthAcquired}&yearAcquired=${yearAcquired}&yearApplied=${yearApplied}&year5=${year5}&year7=${year7}&year15=${year15}`;

  if (parseFloat(fees) > 0) {
    executeScriptURL += `&fees=${fees}`;
  }
  console.log(executeScriptURL);

  const { data } = await axios.get(executeScriptURL);
  if (!data.success) {
    throw `Error ${JSON.stringify(data)}`;
  }
  return {
    depreciation: data.W25,
    taxImpactOnDepreciationDifference: data.X25,
    afterTaxStudyFee: data.AA15,
  };
};

const updateTickets = async (tickets) => {
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
      console.error("Error updating the ticket:", error.message);
    }
  }
};

const batchCreateLineItems = async (ticketsPropsAndData, dealID) => {
  const inputs = ticketsPropsAndData.map((ticket) => {
    return {
      properties: {
        cost_basis: ticket.props.cost_basis,
        projected_additional_depreciation: ticket.data.depreciation,
        in_service_date: ticket.props.property_placed_in_service_date,
        name: `${ticket.props.subject_property_address_1}`,
        quantity: "1",
        tax_impact_on_depreciation_difference: ticket.data.taxImpactOnDepreciationDifference,
        after_tax_study_fee: ticket.data.afterTaxStudyFee,
        related_ticket_id: ticket.id,
      },
      associations: [
        {
          to: {
            id: dealID,
          },
          types: [
            {
              associationCategory: "HUBSPOT_DEFINED",
              associationTypeId: 20,
            },
          ],
        },
      ],
    };
  });
  try {
    const result = await hubspotClient.crm.lineItems.batchApi.create({ inputs });
    console.log("Batch Create Line Items result", JSON.stringify(result));
  } catch (error) {
    console.error("Error creating batch line items:", error.message);
    throw error;
  }
};

exports.initialSaveData = async (url, accessToken, dealId) => {
  console.log(url);
  console.log(accessToken);
  console.log(dealId);
  googleApiUrl = url;
  console.log(googleApiUrl);

  hubspotClient = new hubspot.Client({ accessToken: accessToken });

  const dealsAssociatedTickets = await getDealsAssociatedTickets(dealId);
  console.log(`dealsAssociatedTickets ${JSON.stringify(dealsAssociatedTickets)}`);

  const ticketsPropsAndData = [];

  try {
    for (const ticket of dealsAssociatedTickets.results) {
      const props = ticket.properties;
      const placedDate = new Date(props.property_placed_in_service_date);
      const data = await getCalculatedProperties(
        props.building_type,
        props.cost_basis,
        placedDate.getMonth() + 1,
        placedDate.getFullYear(),
        props.property__bonus__year_applied,
        props.property_5yr_est,
        props.property_7yr_est,
        props.property_15yr_est,
        props.fees
      );
      ticketsPropsAndData.push({ id: ticket.id, props, data });
    }
    console.log("ticketPropsAndData", ticketsPropsAndData);

    await updateTickets(ticketsPropsAndData);
    await batchCreateLineItems(ticketsPropsAndData, dealId);
  } catch (error) {
    console.log(error);
  }
};
