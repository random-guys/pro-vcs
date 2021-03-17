import faker from "faker";

export function newUser() {
  return {
    id: faker.random.uuid(),
    email_address: faker.internet.email(),
    metadata: {
      first_name: faker.name.firstName(),
      last_name: faker.name.lastName()
    }
  };
}

export function newBeneficiaryDTO() {
  return {
    account_name: faker.company.companyName(),
    account_number: faker.finance.account(10),
    bank_code: faker.finance.account(6),
    workspace: faker.random.uuid()
  };
}
