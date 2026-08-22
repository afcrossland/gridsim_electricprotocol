/**
 * The Citizens Electrification Charter, as published in
 * "Citizens Electrification Charter.docx".
 *
 * Kept as data rather than markup so the welcome screen, and anything else that
 * needs it later, render the same text from one place. Edit here if the source
 * document changes.
 */
export const CHARTER = {
  title: "Citizens Electrification Charter",

  intro: [
    "People and communities will play an increasingly critical role in how energy is produced, managed, and shared as distributed, consumer-sited energy resources like solar, EVs and batteries complement supply from utility scale resources.",
    "The lowest cost energy solution in aggregate will come from the creation of a level playing field for all energy resources, of all sizes, competing equally to deliver electricity and grid services on the emerging world-wide-grid. To ensure equitable transition of this behind the meter technology, policies are needed that remove unnecessary barriers and support local action.",
    "This Charter, underpinned by the detailed Electric Protocol, sets out clear principles to guide regulation and market design to ensure a level playing field for all assets on the grid. It is about choice, fairness, and ensuring the lowest overall cost of energy delivery - and recognises that people will be at the heart of the energy transition.",
  ],

  rights: [
    {
      heading: "The right to choose",
      body: "Everyone has an inherent right to choose where to get their electricity from, including an explicit right to 100% low carbon supply. That choice should be enabled through open data and affordable finance.",
    },
    {
      heading: "The right to connect",
      body: "Everyone has the right to safely install technology to generate, use, self-consume and store low-carbon electricity, without penalty. Permitting and connection of equipment behind the meter should be free, easy and efficient.",
    },
    {
      heading: "The right to be compensated fairly",
      body: "Everyone has the right to be compensated for the value they provide to the grid. Behind the meter technology should have the same market access rights as all front of the meter technology. All market mechanisms should be compensated to all at transparent, fair prices with easy market access.",
    },
  ],
} as const;
