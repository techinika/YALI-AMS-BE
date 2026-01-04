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
  getMyGroups,
  removeUserFromGroup,
  sendGroupMessage,
} from "../controllers/ChatControllers/GroupChats";
import {
  acceptGroupInvitation,
  approveGroupJoinRequest,
  declineGroupInvitation,
  rejectJoinRequest,
  requestToJoinGroup,
} from "../controllers/ChatControllers/JoinGroup";

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

chatRouter.get("/group/messages/:groupId/:userId", getGroupMessages);
chatRouter.post("/group/messages/:groupId/:userId", sendGroupMessage);

chatRouter.get("/group/all", getAllGroups);
chatRouter.get("/group/:groupId", getGroupById);
chatRouter.get("/group/my/:userId", getMyGroups);

chatRouter.post("/group/join-request/", requestToJoinGroup);
chatRouter.post("/group/approve-request/admin", approveGroupJoinRequest);
chatRouter.post("/group/approve-request/member", acceptGroupInvitation);

chatRouter.post("/group/reject-request/:groupId", rejectJoinRequest);
chatRouter.post("/group/decline-request/:groupId", declineGroupInvitation);

export default chatRouter;
