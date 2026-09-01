jest.mock("../../../libs/messengerBot", () => ({
  getMessengerBot: jest.fn()
}));

jest.mock("../../../models/Message", () => ({
  __esModule: true,
  default: {
    update: jest.fn()
  }
}));

jest.mock("../../../services/TicketServices/ShowTicketService", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    warn: jest.fn()
  }
}));

jest.mock("../../../helpers/GetTicketWbot", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../helpers/socketEmit", () => ({
  __esModule: true,
  default: jest.fn()
}));

import Message from "../../../models/Message";
import ShowTicketService from "../../../services/TicketServices/ShowTicketService";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import socketEmit from "../../../helpers/socketEmit";
import SetTicketMessagesAsRead from "../../../helpers/SetTicketMessagesAsRead";

const updateMessagesMock = Message.update as jest.Mock;
const showTicketServiceMock = ShowTicketService as jest.Mock;
const startSessionVerifyMock = StartWhatsAppSessionVerify as jest.Mock;
const getTicketWbotMock = GetTicketWbot as jest.Mock;
const socketEmitMock = socketEmit as jest.Mock;

describe("SetTicketMessagesAsRead", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    showTicketServiceMock.mockResolvedValue({ id: 10, unreadMessages: 0 });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("marks local messages as read and emits a ticket update", async () => {
    const ticket = {
      id: 10,
      tenantId: 5,
      channel: "whatsapp",
      whatsappId: 99,
      isGroup: false,
      contact: {
        number: "5511999999999"
      },
      update: jest.fn().mockResolvedValue(undefined)
    };
    const sendSeenMock = jest.fn().mockResolvedValue(undefined);
    getTicketWbotMock.mockResolvedValue({
      sendSeen: sendSeenMock
    });

    await SetTicketMessagesAsRead(ticket as never);

    expect(updateMessagesMock).toHaveBeenCalledWith(
      { read: true },
      {
        where: {
          ticketId: 10,
          read: false
        }
      }
    );
    expect(ticket.update).toHaveBeenCalledWith({ unreadMessages: 0 });
    expect(sendSeenMock).toHaveBeenCalledWith("5511999999999@c.us");
    expect(showTicketServiceMock).toHaveBeenCalledWith({
      id: 10,
      tenantId: 5
    });
    expect(socketEmitMock).toHaveBeenCalledWith({
      tenantId: 5,
      type: "ticket:update",
      payload: { id: 10, unreadMessages: 0 }
    });
  });

  it("verifies the WhatsApp session when sendSeen rejects", async () => {
    const error = new Error("session closed");
    const ticket = {
      id: 10,
      tenantId: 5,
      channel: "whatsapp",
      whatsappId: 99,
      isGroup: true,
      contact: {
        number: "5511888888888"
      },
      update: jest.fn().mockResolvedValue(undefined)
    };
    const sendSeenMock = jest.fn().mockRejectedValue(error);
    getTicketWbotMock.mockResolvedValue({
      sendSeen: sendSeenMock
    });

    await SetTicketMessagesAsRead(ticket as never);
    await Promise.resolve();

    expect(sendSeenMock).toHaveBeenCalledWith("5511888888888@g.us");
    expect(startSessionVerifyMock).toHaveBeenCalledWith(99, error);
    expect(console.error).toHaveBeenCalledWith(
      "não foi possível marcar como lido",
      error
    );
    expect(socketEmitMock).toHaveBeenCalledWith({
      tenantId: 5,
      type: "ticket:update",
      payload: { id: 10, unreadMessages: 0 }
    });
  });
});
