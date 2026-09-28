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

describe("SetTicketMessagesAsRead", () => {
  const consoleError = jest.spyOn(console, "error").mockImplementation();

  beforeEach(() => {
    jest.clearAllMocks();
    (ShowTicketService as jest.Mock).mockResolvedValue({
      id: 10,
      unreadMessages: 0
    });
  });

  afterAll(() => {
    consoleError.mockRestore();
  });

  it("marks unread messages as read and emits the reloaded ticket", async () => {
    const sendSeen = jest.fn().mockResolvedValue(undefined);
    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendSeen });
    const ticket = {
      id: 10,
      tenantId: 20,
      channel: "whatsapp",
      whatsappId: 30,
      isGroup: false,
      contact: {
        number: "5511999999999"
      },
      update: jest.fn()
    };

    await SetTicketMessagesAsRead(ticket as never);

    expect(Message.update).toHaveBeenCalledWith(
      { read: true },
      {
        where: {
          ticketId: 10,
          read: false
        }
      }
    );
    expect(ticket.update).toHaveBeenCalledWith({ unreadMessages: 0 });
    expect(sendSeen).toHaveBeenCalledWith("5511999999999@c.us");
    expect(ShowTicketService).toHaveBeenCalledWith({
      id: 10,
      tenantId: 20
    });
    expect(socketEmit).toHaveBeenCalledWith({
      tenantId: 20,
      type: "ticket:update",
      payload: {
        id: 10,
        unreadMessages: 0
      }
    });
  });

  it("verifies the WhatsApp session when sendSeen fails asynchronously", async () => {
    const error = new Error("session closed");
    const sendSeen = jest.fn().mockRejectedValue(error);
    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendSeen });
    const ticket = {
      id: 10,
      tenantId: 20,
      channel: "whatsapp",
      whatsappId: 30,
      isGroup: true,
      contact: {
        number: "5511888888888"
      },
      update: jest.fn()
    };

    await SetTicketMessagesAsRead(ticket as never);
    await Promise.resolve();

    expect(sendSeen).toHaveBeenCalledWith("5511888888888@g.us");
    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(30, error);
    expect(consoleError).toHaveBeenCalledWith(
      "não foi possível marcar como lido",
      error
    );
    expect(socketEmit).toHaveBeenCalled();
  });
});
