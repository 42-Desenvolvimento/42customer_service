export {};

jest.mock("../../../libs/messengerBot", () => ({
  getMessengerBot: jest.fn()
}));
jest.mock("../../../models/Message", () => ({
  update: jest.fn()
}));
jest.mock("../../../services/TicketServices/ShowTicketService", () =>
  jest.fn()
);
jest.mock(
  "../../../services/WbotServices/StartWhatsAppSessionVerify",
  () => ({
    StartWhatsAppSessionVerify: jest.fn()
  })
);
jest.mock("../../../utils/logger", () => ({
  logger: {
    warn: jest.fn()
  }
}));
jest.mock("../../../helpers/GetTicketWbot", () => jest.fn());
jest.mock("../../../helpers/socketEmit", () => jest.fn());

import Message from "../../../models/Message";
import ShowTicketService from "../../../services/TicketServices/ShowTicketService";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import socketEmit from "../../../helpers/socketEmit";
import SetTicketMessagesAsRead from "../../../helpers/SetTicketMessagesAsRead";

const messageUpdateMock = Message.update as jest.Mock;
const showTicketServiceMock = ShowTicketService as jest.Mock;
const startWhatsAppSessionVerifyMock = StartWhatsAppSessionVerify as jest.Mock;
const getTicketWbotMock = GetTicketWbot as jest.Mock;
const socketEmitMock = socketEmit as jest.Mock;

describe("SetTicketMessagesAsRead", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("marks WhatsApp messages as read and emits the refreshed ticket", async () => {
    const sendSeen = jest.fn().mockResolvedValue(undefined);
    const reloadedTicket = {
      id: 5,
      unreadMessages: 0
    };
    const ticket = {
      id: 5,
      tenantId: 3,
      whatsappId: 7,
      channel: "whatsapp",
      isGroup: false,
      contact: {
        number: "554299999999"
      },
      update: jest.fn()
    };

    getTicketWbotMock.mockResolvedValue({ sendSeen });
    showTicketServiceMock.mockResolvedValue(reloadedTicket);

    await SetTicketMessagesAsRead(ticket as any);

    expect(messageUpdateMock).toHaveBeenCalledWith(
      { read: true },
      {
        where: {
          ticketId: 5,
          read: false
        }
      }
    );
    expect(ticket.update).toHaveBeenCalledWith({ unreadMessages: 0 });
    expect(sendSeen).toHaveBeenCalledWith("554299999999@c.us");
    expect(showTicketServiceMock).toHaveBeenCalledWith({
      id: 5,
      tenantId: 3
    });
    expect(socketEmitMock).toHaveBeenCalledWith({
      tenantId: 3,
      type: "ticket:update",
      payload: reloadedTicket
    });
    expect(startWhatsAppSessionVerifyMock).not.toHaveBeenCalled();
  });

  it("verifies the WhatsApp session when sendSeen fails asynchronously", async () => {
    const sendSeenError = new Error(
      "Cannot read property 'sendSeen' of undefined"
    );
    const sendSeen = jest.fn().mockRejectedValue(sendSeenError);
    const ticket = {
      id: 6,
      tenantId: 3,
      whatsappId: 8,
      channel: "whatsapp",
      isGroup: true,
      contact: {
        number: "554288888888"
      },
      update: jest.fn()
    };

    getTicketWbotMock.mockResolvedValue({ sendSeen });
    showTicketServiceMock.mockResolvedValue({
      id: 6,
      unreadMessages: 0
    });

    await SetTicketMessagesAsRead(ticket as any);
    await Promise.resolve();

    expect(sendSeen).toHaveBeenCalledWith("554288888888@g.us");
    expect(startWhatsAppSessionVerifyMock).toHaveBeenCalledWith(
      8,
      sendSeenError
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "não foi possível marcar como lido",
      sendSeenError
    );
    expect(socketEmitMock).toHaveBeenCalledWith({
      tenantId: 3,
      type: "ticket:update",
      payload: {
        id: 6,
        unreadMessages: 0
      }
    });
  });
});
