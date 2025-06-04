// lib/tenantStore.js
//
// A single in‐memory object to hold all tenant data. 
// Both create‐tenant, list/[tenant], and webhook/[tenant] will import this.

const tenants = {};
module.exports = tenants;
