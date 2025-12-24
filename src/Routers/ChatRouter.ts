import { Router } from "express";
import {
  getMessages,
  getPrivateChats,
  getPrivateMessages,
  sendMessage,
} from "../controllers/ChatControllers/MessageController";
import { getTopActiveMembers } from "../controllers/ChatControllers/topMembers";
import {
  addMemberToGroup,
  createGroup,
  getAllGroups,
  getGroupById,
  getGroupMembers,
  getGroupMessages,
  removeUserFromGroup,
  sendGroupMessage,
} from "../controllers/ChatControllers/GroupChats";

const chatRouter = Router();

chatRouter.get("/top", getTopActiveMembers);
chatRouter.post("/", sendMessage);
chatRouter.get("/", getMessages);
chatRouter.get("/:id/:oid", getPrivateMessages);
chatRouter.get("/:id", getPrivateChats);

chatRouter.post("/group/create", createGroup);
chatRouter.post("/group/add-member/:groupId", addMemberToGroup);
chatRouter.delete("/group/remove-member", removeUserFromGroup);
chatRouter.get("/group/get-members/:groupId", getGroupMembers);
chatRouter.get("/group/messages/:groupId", getGroupMessages);
chatRouter.post("/group/messages/:groupId", sendGroupMessage);
chatRouter.get("/group/all", getAllGroups);
chatRouter.get("/group/:groupId", getGroupById);

export default chatRouter;
