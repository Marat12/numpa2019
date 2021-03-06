const AdminContactsController = require("../../controllers/admin/AdminContactsController");

const express = require("express");
const router = express.Router();
const { ensureAuthenticated, redirectNonAdmin } = require('../../helpers/helper')

router.get("/", ensureAuthenticated, redirectNonAdmin, AdminContactsController.getContacts);

module.exports = router;
