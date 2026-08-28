jest.mock("../../libs/messengerBot", () => ({
  getMessengerBot: jest.fn()
}));

jest.mock("../../models/Message", () => ({
  update: jest.fn()
}));

jest.mock("../../services/TicketServices/ShowTicketService", () => jest.fn());

jest.mock("../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));

jest.mock("../../utils/logger", () => ({
  logger: {
    warn: jest.fn()
  }
}));

jest.mock("../../helpers/GetTicketWbot", () => jest.fn());

jest.mock("../../helpers/socketEmit", () => jest.fn());

import Message from "../../models/Message";
import ShowTicketService from "../../services/TicketServices/ShowTicketService";
import { StartWhatsAppSessionVerify } from "../../services/WbotServices/StartWhatsAppSessionVerify";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import SetTicketMessagesAsRead from "../../helpers/SetTicketMessagesAsRead";
import socketEmit from "../../helpers/socketEmit";

const updateMessagesMock = Message.update as jest.Mock;
const showTicketServiceMock = ShowTicketService as jest.Mock;
const startWhatsAppSessionVerifyMock = StartWhatsAppSessionVerify as jest.Mock;
const getTicketWbotMock = GetTicketWbot as jest.Mock;
const socketEmitMock = socketEmit as jest.Mock;

const makeTicket = () =>
  ({
    id: 123,
    tenantId: 9,
    whatsappId: 44,
    channel: "whatsapp",
    isGroup: false,
    contact: {
      number: "5511888888888"
    },
    update: jest.fn().mockResolvedValue(undefined)
  } as any);

describe("SetTicketMessagesAsRead", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    showTicketServiceMock.mockResolvedValue({
      id: 123,
      unreadMessages: 0
    });
  });

  it("marks messages as read, emits the reloaded ticket and verifies the session when sendSeen rejects", async () => {
    const ticket = makeTicket();
    const error = new Error("sendSeen failed");
    const sendSeen = jest.fn().mockRejectedValue(error);
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    getTicketWbotMock.mockResolvedValue({ sendSeen });

    await SetTicketMessagesAsRead(ticket);
    await Promise.resolve();

    expect(updateMessagesMock).toHaveBeenCalledWith(
      { read: true },
      {
        where: {
          ticketId: 123,
          read: false
        }
      }
    );
    expect(ticket.update).toHaveBeenCalledWith({ unreadMessages: 0 });
    expect(sendSeen).toHaveBeenCalledWith("5511888888888@c.us");
    expect(startWhatsAppSessionVerifyMock).toHaveBeenCalledWith(44, error);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "não foi possível marcar como lido",
      error
    );
    expect(showTicketServiceMock).toHaveBeenCalledWith({
      id: 123,
      tenantId: 9
    });
    expect(socketEmitMock).toHaveBeenCalledWith({
      tenantId: 9,
      type: "ticket:update",
      payload: {
        id: 123,
        unreadMessages: 0
      }
    });

    consoleErrorSpy.mockRestore();
  });
});
