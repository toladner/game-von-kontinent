import { useLocaleStore } from './app/locale'

/**
 * Every test runs in German.
 *
 * Not a preference — a fixture. The suite asserts on copy in a good many
 * places ("Kurs ändern auf …", "Schiff eingelaufen"), and without pinning the
 * language those assertions would depend on what the machine running them
 * happens to report in `navigator.languages`: green on a German laptop, red in
 * CI, and nobody the wiser as to why.
 *
 * German because it is the game's own language and the copy the assertions
 * were written against. A test that cares about the English is free to set it
 * for itself.
 */
useLocaleStore.setState({ locale: 'de' })
