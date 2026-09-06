jest.mock("date-fns", () => ({
  getHours: jest.fn()
}));

import { getHours } from "date-fns";
import { MissingValueError, pupa } from "../../../utils/pupa";

const getHoursMock = getHours as jest.Mock;

describe("pupa utility", () => {
  beforeEach(() => {
    getHoursMock.mockReturnValue(12);
  });

  it.each([
    [5, "Olá!"],
    [6, "Bom dia!"],
    [11, "Bom dia!"],
    [12, "Boa Tarde!"],
    [17, "Boa Tarde!"],
    [18, "Boa Noite!"],
    [23, "Boa Noite!"]
  ])("interpolates greeting for hour %s", (hour, greeting) => {
    getHoursMock.mockReturnValue(hour);

    expect(pupa("{greeting} {name}", { name: "Cliente" })).toBe(
      `${greeting} Cliente`
    );
  });

  it("keeps contact template values and escapes only double-braced placeholders", () => {
    const result = pupa(
      "{greeting} {contact.name}: {{message}} / {protocol.id}",
      {
        contact: { name: "Ana & Bob" },
        message: "<b>teste</b>",
        protocol: { id: "ABC-123" }
      }
    );

    expect(result).toBe(
      "Boa Tarde! Ana & Bob: &lt;b&gt;teste&lt;/b&gt; / ABC-123"
    );
  });

  it("supports transform without breaking template interpolation", () => {
    const transformed = pupa(
      "{name} {protocol}",
      { name: "ana" },
      {
        transform: ({ value, key }) =>
          key === "name" ? String(value).toUpperCase() : value
      }
    );

    expect(transformed).toBe("ANA ");
  });

  it("raises MissingValueError when missing values are required", () => {
    expect(() =>
      pupa("{name} {missing}", { name: "Ana" }, { ignoreMissing: false })
    ).toThrow(MissingValueError);
  });
});
