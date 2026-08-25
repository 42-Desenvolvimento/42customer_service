import Message from "../../../models/Message";
import SetTicketMessagesAsRead from "../../../helpers/SetTicketMessagesAsRead";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import socketEmit from "../../../helpers/socketEmit";
import ShowTicketService from "../../../services/TicketServices/ShowTicketService";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";

jest.mock("../../../models/Message", () => ({
  update: jest.fn()
}));

jest.mock("../../../helpers/GetTicketWbot", () => jest.fn());

jest.mock("../../../helpers/socketEmit", () => jest.fn());

jest.mock("../../../services/TicketServices/ShowTicketService", () =>
  jest.fn()
);

jest.mock("../../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));

jest.mock("../../../libs/messengerBot", () => ({
  getMessengerBot: jest.fn()
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    warn: jest.fn()
  }
}));

const updateMessagesMock = Message.update as jest.Mock;
const getTicketWbotMock = GetTicketWbot as jest.Mock;
const socketEmitMock = socketEmit as jest.Mock;
const showTicketServiceMock = ShowTicketService as jest.Mock;
const startWhatsAppSessionVerifyMock = StartWhatsAppSessionVerify as jest.Mock;

const makeTicket = () =>
  ({
    id: 12,
    tenantId: 34,
    whatsappId: 56,
    channel: "whatsapp",
    isGroup: false,
    contact: {
      number: "55988887777"
    },
    update: jest.fn().mockResolvedValue(undefined)
  } as any);

describe("SetTicketMessagesAsRead", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    updateMessagesMock.mockResolvedValue([1]);
    showTicketServiceMock.mockResolvedValue({
      id: 12,
      unreadMessages: 0
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("should mark local ticket messages as read and emit the updated ticket", async () => {
    const ticket = makeTicket();
    const sendSeenMock = jest.fn().mockResolvedValue(undefined);
    getTicketWbotMock.mockResolvedValue({
      sendSeen: sendSeenMock
    });

    await SetTicketMessagesAsRead(ticket);

    expect(updateMessagesMock).toHaveBeenCalledWith(
      { read: true },
      {
        where: {
          ticketId: 12,
          read: false
        }
      }
    );
    expect(ticket.update).toHaveBeenCalledWith({ unreadMessages: 0 });
    expect(sendSeenMock).toHaveBeenCalledWith("55988887777@c.us");
    expect(showTicketServiceMock).toHaveBeenCalledWith({
      id: 12,
      tenantId: 34
    });
    expect(socketEmitMock).toHaveBeenCalledWith({
      tenantId: 34,
      type: "ticket:update",
      payload: {
        id: 12,
        unreadMessages: 0
      }
    });
    expect(startWhatsAppSessionVerifyMock).not.toHaveBeenCalled();
  });

  it("should verify the WhatsApp session when sendSeen is rejected", async () => {
    const ticket = makeTicket();
    const error = new Error("Cannot read property 'sendSeen' of undefined");
    const sendSeenMock = jest.fn().mockRejectedValue(error);
    getTicketWbotMock.mockResolvedValue({
      sendSeen: sendSeenMock
    });

    await SetTicketMessagesAsRead(ticket);
    await Promise.resolve();

    expect(startWhatsAppSessionVerifyMock).toHaveBeenCalledWith(56, error);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "não foi possível marcar como lido",
      error
    );
    expect(socketEmitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 34,
        type: "ticket:update"
      })
    );
  });
});
