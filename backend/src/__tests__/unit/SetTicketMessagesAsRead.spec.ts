jest.mock("../../libs/messengerBot", () => ({
  getMessengerBot: jest.fn()
}));
jest.mock("../../models/Message", () => ({
  __esModule: true,
  default: {
    update: jest.fn()
  }
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

const messageUpdateMock = Message.update as jest.Mock;
const showTicketServiceMock = ShowTicketService as jest.Mock;
const startWhatsAppSessionVerifyMock = StartWhatsAppSessionVerify as jest.Mock;
const getTicketWbotMock = GetTicketWbot as jest.Mock;
const socketEmitMock = socketEmit as jest.Mock;

describe("SetTicketMessagesAsRead", () => {
  const consoleErrorSpy = jest
    .spyOn(console, "error")
    .mockImplementation(() => undefined);

  beforeEach(() => {
    jest.clearAllMocks();
    showTicketServiceMock.mockResolvedValue({ id: 10, reloaded: true });
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  const buildTicket = () =>
    ({
      id: 10,
      tenantId: 20,
      whatsappId: 30,
      channel: "whatsapp",
      isGroup: false,
      contact: {
        number: "5511888888888"
      },
      update: jest.fn()
    } as any);

  it("marks local messages as read and emits the reloaded ticket", async () => {
    const sendSeen = jest.fn().mockResolvedValue(undefined);
    getTicketWbotMock.mockResolvedValue({ sendSeen });
    const ticket = buildTicket();

    await SetTicketMessagesAsRead(ticket);

    expect(messageUpdateMock).toHaveBeenCalledWith(
      { read: true },
      {
        where: {
          ticketId: 10,
          read: false
        }
      }
    );
    expect(ticket.update).toHaveBeenCalledWith({ unreadMessages: 0 });
    expect(sendSeen).toHaveBeenCalledWith("5511888888888@c.us");
    expect(showTicketServiceMock).toHaveBeenCalledWith({
      id: 10,
      tenantId: 20
    });
    expect(socketEmitMock).toHaveBeenCalledWith({
      tenantId: 20,
      type: "ticket:update",
      payload: {
        id: 10,
        reloaded: true
      }
    });
  });

  it("verifies the WhatsApp session when sendSeen rejects", async () => {
    const sendSeenError = new Error("Cannot read property 'sendSeen' of undefined");
    getTicketWbotMock.mockResolvedValue({
      sendSeen: jest.fn().mockRejectedValue(sendSeenError)
    });

    await SetTicketMessagesAsRead(buildTicket());
    await Promise.resolve();

    expect(startWhatsAppSessionVerifyMock).toHaveBeenCalledWith(
      30,
      sendSeenError
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "não foi possível marcar como lido",
      sendSeenError
    );
  });
});
