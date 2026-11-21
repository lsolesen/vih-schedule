// js/courses.js
// Ren fagstruktur uden hardkodede ønsker — ønsker hentes fra CSV-links / Importér Filer
export const COURSE_STRUCTURE = {
  E2026: {
    label: "Efterår 2026",
    phases: [
      { id: "E1", label: "Aug–Okt", weight: 1 },
      { id: "E2", label: "Okt–Dec", weight: 1 }
    ],
    dglConfig: {
      hoursPerTeam: 3,
      teamCount: 6,
      teachers: [],
      wishes: []
    },
    sangConfig: {
      weeklyHours: 1.5,
      teacherCount: 2,
      splitHours: true,
      teachers: [],
      wishes: []
    },
    timelineBlocks: [
      {
        id: "E1_I1", name: "IDRÆT 1 • 1. Periode", span: 1, defaultHours: 4, activePhases: ["E1"],
        courses: [
          { name: "Adventurerace 🗺️", hours: 4, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Bold 360", hours: 4, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "COPS - Polititræning 👮", hours: 4, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Fitness 360° 😅", hours: 4, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Fodbold ⚽", hours: 4, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Håndbold 🤾", hours: 4, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Padel (+1000 DKK) 🎾", hours: 4, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Yoga - Hatha, Aerial & Akro 🧘", hours: 4, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "YoSurf'n'Climb 🏄", hours: 4, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] }
        ]
      },
      {
        id: "E1_I2", name: "IDRÆT 2 • 1. Periode", span: 1, defaultHours: 4, activePhases: ["E1"],
        courses: [
          { name: "Adventure 360° 🧗", hours: 4, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Crossfitness 🏋️", hours: 4, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Fitness Holdtræning 🕺🏼", hours: 4, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Havkajak 🚣‍♀️", hours: 4, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Ketsjer 360", hours: 4, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Multisport ♟️", hours: 4, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Volleyball & Beachvolley 🏐", hours: 4, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] }
        ]
      },
      {
        id: "E1_K", name: "KOMPETENCEFAG • 1. Periode", span: 1, defaultHours: 4.5, activePhases: ["E1"],
        courses: [
          { name: "Ernæring & Forbrænding 🥕", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Friluftsliv 🌳", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "International Class 🏳️‍🌈", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Medier & Kommunikation 🗒️", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Musik 🎶", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Personlig power 🦸", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Politi 👮", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Sportspsykologi & Teamplayer 🤯", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] }
        ]
      },
      {
        id: "E1_IN", name: "INSPIRATIONSFAG • 1. Periode", span: 1, defaultHours: 2, activePhases: ["E1"],
        courses: [
          { name: "Inspirationsfag 1", hours: 2, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Inspirationsfag 2", hours: 2, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Inspirationsfag 3", hours: 2, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Inspirationsfag 4", hours: 2, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Inspirationsfag 5", hours: 2, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Inspirationsfag 6", hours: 2, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Inspirationsfag 7", hours: 2, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Inspirationsfag 8", hours: 2, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] }
        ]
      },
      {
        id: "E2_I1", name: "IDRÆT 1 • 2. Periode", span: 1, defaultHours: 4, activePhases: ["E2"],
        courses: [
          { name: "Basketball 🏀", hours: 4, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Cardio Attack ❤️", hours: 4, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Fodbold & Pigefodbold ⚽", hours: 4, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Functional Training 😅", hours: 4, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Håndbold 🤾", hours: 4, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Indoor Bike Xperience", hours: 4, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Løb & Løbetræning 👟", hours: 4, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Padel (+1000 DKK) 🎾", hours: 4, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Styrketræning 💪", hours: 4, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] }
        ]
      },
      {
        id: "E2_I2", name: "IDRÆT 2 • 2. Periode", span: 1, defaultHours: 4, activePhases: ["E2"],
        courses: [
          { name: "Badminton & Racket Sports 🏸", hours: 4, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Styrketræning 🏋️", hours: 4, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Dance 🕺🏼", hours: 4, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Fighter 🥷🏻", hours: 4, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Futsal ⚽", hours: 4, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Game changer 🎲", hours: 4, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Mountainbike & Trail Surfing 🚵", hours: 4, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] }
        ]
      },
      {
        id: "E2_K", name: "KOMPETENCEFAG • 2. Periode", span: 1, defaultHours: 4.5, activePhases: ["E2"],
        courses: [
          { name: "Body & Mind 😶‍🌫️", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Bryg & Bål 🔥", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Fitnessinstruktør 🏋️", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Leadership", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Musik 🎶", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Psykologi 🧠", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Sportsjournalistik 🗒️", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Test & træning 🧑‍🔬", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] }
        ]
      },
      {
        id: "E2_IN", name: "INSPIRATIONSFAG • 2. Periode", span: 1, defaultHours: 2, activePhases: ["E2"],
        courses: [
          { name: "Inspirationsfag 1", hours: 2, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Inspirationsfag 2", hours: 2, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Inspirationsfag 3", hours: 2, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Inspirationsfag 4", hours: 2, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Inspirationsfag 5", hours: 2, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Inspirationsfag 6", hours: 2, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Inspirationsfag 7", hours: 2, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Inspirationsfag 8", hours: 2, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] }
        ]
      }
    ]
  },

  F2026: {
    label: "Forår 2026/27",
    phases: [
      { id: "F1", label: "Jan–Feb", weight: 2 },
      { id: "F2a", label: "Mar", weight: 1 },
      { id: "F2b", label: "Apr", weight: 1 },
      { id: "F3", label: "Maj–Jun", weight: 2 }
    ],
    dglConfig: {
      hoursPerTeam: 3,
      teamCount: 6,
      teachers: [],
      wishes: []
    },
    sangConfig: {
      weeklyHours: 1.5,
      teacherCount: 3,
      splitHours: true,
      teachers: [],
      wishes: []
    },
    timelineBlocks: [
      // IDRÆT 1 (3 perioder: Jan–Feb, Mar–Apr, Maj–Jun)
      {
        id: "F1_I1", name: "IDRÆT 1 • Forår 1", span: 2, defaultHours: 4.5, activePhases: ["F1"],
        courses: [
          { name: "Fitness 360° 😅", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Fodbold ⚽", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Håndbold 🤾", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Indoor Bike Xperience", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Løb & Løbetræning 👟", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Multisport ♟️", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Padel (+1000 DKK) 🎾", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Styrketræning 💪", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Yoga - Hatha, Aerial & Akro 🧘", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] }
        ]
      },
      {
        id: "F2_I1", name: "IDRÆT 1 • Forår 2", span: 2, defaultHours: 4.5, activePhases: ["F2a", "F2b"],
        courses: [
          { name: "Adventurerace 🗺️", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Balanced Body & Movement", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Basketball 🏀", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Cardio Attack ❤️", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "COPS - Polititræning 👮", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Fodbold & Pigefodbold ⚽", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Håndbold 🤾", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Løb & Løbetræning 👟", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Styrke & Power Performance", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] }
        ]
      },
      {
        id: "F3_I1", name: "IDRÆT 1 • Forår 3", span: 2, defaultHours: 4, activePhases: ["F3"],
        courses: [
          { name: "Basketball 🏀", hours: 4, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Beach Sport", hours: 4, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Bold 360", hours: 4, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Bootcamp 🥵", hours: 4, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Fodbold ⚽", hours: 4, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Functional Training 😅", hours: 4, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Padel (+1000 DKK) 🎾", hours: 4, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Styrke & Calisthenics", hours: 4, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "YoSurf'n'Climb 🏄", hours: 4, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] }
        ]
      },

      // IDRÆT 2 (3 perioder: Jan–Feb, Mar–Apr, Maj–Jun)
      {
        id: "F1_I2", name: "IDRÆT 2 • Forår 1", span: 2, defaultHours: 4.5, activePhases: ["F1"],
        courses: [
          { name: "Adventure 360° 🧗", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Badminton & Racket Sports 🏸", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Crossfitness 🏋️", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Fitness Holdtræning 🕺🏼", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Futsal ⚽", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Power Endurance Sport", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Power Fitness 🏋️", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Toughest 🧼", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] }
        ]
      },
      {
        id: "F2_I2", name: "IDRÆT 2 • Forår 2", span: 2, defaultHours: 4.5, activePhases: ["F2a", "F2b"],
        courses: [
          { name: "Badminton & Racket Sports 🏸", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Bike Team Fusion", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Dance 🕺🏼", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Fodbold & Playertek ⚽", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Game changer 🎲", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Mountainbike & Trail Surfing 🚵", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "OCR & Fun Run 🏃‍♂️", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Styrketræning 💪", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Volleyball & Beachvolley 🏐", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] }
        ]
      },
      {
        id: "F3_I2", name: "IDRÆT 2 • Forår 3", span: 2, defaultHours: 4, activePhases: ["F3"],
        courses: [
          { name: "Crossfitness 🏋️", hours: 4, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Fighter 🥷🏻", hours: 4, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Fitness Holdtræning 🕺🏼", hours: 4, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Havkajak 🚣‍♀️", hours: 4, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Ketsjer 360", hours: 4, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Mountainbike & Trail Surfing 🚵", hours: 4, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Multisport ♟️", hours: 4, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Volleyball & Beachvolley 🏐", hours: 4, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] }
        ]
      },

      // KOMPETENCEFAG (2 perioder: Del 1 Jan–Mar, Del 2 Apr–Jun)
      {
        id: "F1_K", name: "KOMPETENCEFAG • Del 1", span: 3, defaultHours: 4.5, activePhases: ["F1", "F2a"],
        courses: [
          { name: "Bryg & Bål 🔥", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Ernæring & Forbrænding 🥕", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Event Maker", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "International Class 🏳️‍🌈", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Musik 🎶", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Nature Flow & Focus 🌳", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Outdoor & Mountainbikeinstruktør", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Politi 👮", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Psykologi 🧠", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Sportsjournalistik 🗒️", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Test & træning 🧑‍🔬", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] }
        ]
      },
      {
        id: "F2_K", name: "KOMPETENCEFAG • Del 2", span: 3, defaultHours: 4.5, activePhases: ["F2b", "F3"],
        courses: [
          { name: "Gør en forskel 🌸", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Body & Mind 😶‍🌫️", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Fitnessinstruktør 🏋️", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Fodboldtræner & Performance ⚽", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Friluftsliv 🌳", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Medier & Kommunikation 🗒️", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Musik 🎶", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Personlig power 🦸", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Sportspsykologi & Teamplayer 🤯", hours: 4.5, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] }
        ]
      },

      // INSPIRATIONSFAG (2 perioder: Del 1 Jan–Mar, Del 2 Apr–Jun)
      {
        id: "F1_IN", name: "INSPIRATIONSFAG • Del 1", span: 3, defaultHours: 2, activePhases: ["F1", "F2a"],
        courses: [
          { name: "Inspirationsfag 1", hours: 2, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Inspirationsfag 2", hours: 2, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Inspirationsfag 3", hours: 2, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Inspirationsfag 4", hours: 2, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Inspirationsfag 5", hours: 2, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Inspirationsfag 6", hours: 2, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Inspirationsfag 7", hours: 2, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Inspirationsfag 8", hours: 2, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] }
        ]
      },
      {
        id: "F2_IN", name: "INSPIRATIONSFAG • Del 2", span: 3, defaultHours: 2, activePhases: ["F2b", "F3"],
        courses: [
          { name: "Inspirationsfag 1", hours: 2, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Inspirationsfag 2", hours: 2, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Inspirationsfag 3", hours: 2, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Inspirationsfag 4", hours: 2, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Inspirationsfag 5", hours: 2, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Inspirationsfag 6", hours: 2, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Inspirationsfag 7", hours: 2, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] },
          { name: "Inspirationsfag 8", hours: 2, mode: "single", assignments: [], locked: false, wishes1: [], wishes2: [] }
        ]
      }
    ]
  }
};