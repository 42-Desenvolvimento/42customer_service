import Message from "../../../models/Message";
import ShowTicketService from "../../../services/TicketServices/ShowTicketService";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import SetTicketMessagesAsRead from "../../../helpers/SetTicketMessagesAsRead";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import socketEmit from "../../../helpers/socketEmit";

jest.mock("../../../models/Message", () => ({
  update: jest.fn()
}));

jest.mock("../../../helpers/GetTicketWbot", () => jest.fn());

jest.mock("../../../services/TicketServices/ShowTicketService", () =>
  jest.fn()
);

jest.mock("../../../helpers/socketEmit", () => jest.fn());

jest.mock("../../../libs/messengerBot", () => ({
  getMessengerBot: jest.fn()
}));

jest.mock("../../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    warn: jest.fn()
  }
}));

describe("SetTicketMessagesAsRead", () => {
  const messageModel = Message as unknown as { update: jest.Mock };
  const getTicketWbotMock = GetTicketWbot as jest.Mock;
  const showTicketServiceMock = ShowTicketService as jest.Mock;
  const socketEmitMock = socketEmit as jest.Mock;
  const startWhatsAppSessionVerifyMock = StartWhatsAppSessionVerify as jest.Mock;

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

  it("reinicia a sessao quando sendSeen falha ao marcar mensagens do WhatsApp como lidas", async () => {
    const sendSeenError = new Error("session closed");
    const sendSeenMock = jest.fn().mockReturnValue(Promise.reject(sendSeenError));
    const ticketReload = { id: 10, unreadMessages: 0 };
    const ticket = {
      id: 10,
      tenantId: 20,
      whatsappId: 30,
      channel: "whatsapp",
      isGroup: false,
      contact: {
        number: "5511999999999"
      },
      update: jest.fn().mockResolvedValue(undefined)
    };

    messageModel.update.mockResolvedValue([2]);
    getTicketWbotMock.mockResolvedValue({ sendSeen: sendSeenMock });
    showTicketServiceMock.mockResolvedValue(ticketReload);

    await SetTicketMessagesAsRead(ticket as any);
    await Promise.resolve();

    expect(messageModel.update).toHaveBeenCalledWith(
      { read: true },
      {
        where: {
          ticketId: ticket.id,
          read: false
        }
      }
    );
    expect(ticket.update).toHaveBeenCalledWith({ unreadMessages: 0 });
    expect(sendSeenMock).toHaveBeenCalledWith("5511999999999@c.us");
    expect(startWhatsAppSessionVerifyMock).toHaveBeenCalledWith(
      ticket.whatsappId,
      sendSeenError
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "não foi possível marcar como lido",
      sendSeenError
    );
    expect(socketEmitMock).toHaveBeenCalledWith({
      tenantId: ticket.tenantId,
      type: "ticket:update",
      payload: ticketReload
    });
  });
});
