import SetTicketMessagesAsRead from "../../helpers/SetTicketMessagesAsRead";
import socketEmit from "../../helpers/socketEmit";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import { getMessengerBot } from "../../libs/messengerBot";
import Message from "../../models/Message";
import ShowTicketService from "../../services/TicketServices/ShowTicketService";
import { StartWhatsAppSessionVerify } from "../../services/WbotServices/StartWhatsAppSessionVerify";

jest.mock("../../helpers/socketEmit", () => jest.fn());
jest.mock("../../helpers/GetTicketWbot", () => jest.fn());
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

const socketEmitMock = socketEmit as jest.Mock;
const getTicketWbotMock = GetTicketWbot as jest.Mock;
const getMessengerBotMock = getMessengerBot as jest.Mock;
const messageUpdateMock = Message.update as jest.Mock;
const showTicketServiceMock = ShowTicketService as jest.Mock;
const startWhatsAppSessionVerifyMock = StartWhatsAppSessionVerify as jest.Mock;

describe("SetTicketMessagesAsRead", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
    messageUpdateMock.mockResolvedValue([1]);
    showTicketServiceMock.mockResolvedValue({ id: 123, unreadMessages: 0 });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("verifies the WhatsApp session when sendSeen fails asynchronously", async () => {
    const sendSeenError = new Error("session disconnected");
    const sendSeen = jest.fn().mockRejectedValue(sendSeenError);
    getTicketWbotMock.mockResolvedValue({ sendSeen });

    const ticket = {
      id: 123,
      tenantId: 456,
      whatsappId: 789,
      channel: "whatsapp",
      isGroup: false,
      contact: {
        number: "551188887777"
      },
      update: jest.fn().mockResolvedValue(undefined)
    };

    await SetTicketMessagesAsRead(ticket as any);
    await Promise.resolve();

    expect(messageUpdateMock).toHaveBeenCalledWith(
      { read: true },
      {
        where: {
          ticketId: 123,
          read: false
        }
      }
    );
    expect(ticket.update).toHaveBeenCalledWith({ unreadMessages: 0 });
    expect(sendSeen).toHaveBeenCalledWith("551188887777@c.us");
    expect(startWhatsAppSessionVerifyMock).toHaveBeenCalledWith(
      789,
      sendSeenError
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "não foi possível marcar como lido",
      sendSeenError
    );
    expect(showTicketServiceMock).toHaveBeenCalledWith({
      id: 123,
      tenantId: 456
    });
    expect(socketEmitMock).toHaveBeenCalledWith({
      tenantId: 456,
      type: "ticket:update",
      payload: {
        id: 123,
        unreadMessages: 0
      }
    });
    expect(getMessengerBotMock).not.toHaveBeenCalled();
  });
});
