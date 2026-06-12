import { useData } from '../context/DataContext';
import BalancePage from './BalancePage';

function ClickBal({ lang }) {
  return <BalancePage lang={lang} type="click" title="Click qoldig'i" color="#4a148c" />;
}
export default ClickBal;
