/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react'
import { Field, FormError, Input } from './Form'

describe('FormError', () => {
  it('says why something went wrong, as an alert', () => {
    render(<FormError>Couldn&apos;t save.</FormError>)
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't save.")
  })

  it('is nothing when there is nothing to say', () => {
    const { container } = render(<FormError>{null}</FormError>)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('Field', () => {
  it('labels the control inside it, with the hint as part of the label', () => {
    render(
      <Field label="Tags" hint="Separated by commas">
        <Input />
      </Field>,
    )
    expect(screen.getByRole('textbox', { name: 'Tags Separated by commas' })).toBeInTheDocument()
  })
})
